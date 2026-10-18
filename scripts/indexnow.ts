import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { CRAWL_DATA_MAX_BYTES, parseCrawlDataManifest, validateDailyCrawlData, type CrawlDataManifest } from "../lib/crawl-data-contract";
import { readResponseBytes } from "../lib/server/read-response-bytes";
import { buildIndexNowSnapshot, changedIndexNowUrls, type IndexNowSnapshot, type SnapshotFile } from "./indexnow-snapshot";
import { assertIndexNowUrl, INDEXNOW_KEY_LOCATION, INDEXNOW_ORIGIN, submitIndexNow } from "./indexnow-submit";

const PAGES = "https://syu-kr.github.io/campus.syu.kr/crawl-data";
const CACHE_SETTLE_MS = 6 * 60 * 1000;
const git = promisify(execFile);
type State = { schemaVersion: 1; sourceSha: string; version: string; fingerprints: IndexNowSnapshot; submittedAt: Record<string, string> };
type Report = { mode: string; sourceSha: string; version: string; tracked: number; changed: string[]; probes: string[]; accepted: number; pendingValidation: number; error?: string };
type Dependencies = { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; now?: () => number; observedAt?: number; pagesChanged?: boolean };

export function parseIndexNowState(value: unknown): State {
  if (!value || typeof value !== "object") throw new Error("Invalid IndexNow state");
  const s = value as State;
  if (s.schemaVersion !== 1 || !/^[a-f0-9]{40}$/.test(s.sourceSha) || typeof s.version !== "string" || !s.version ||
    !s.fingerprints || typeof s.fingerprints !== "object" || Array.isArray(s.fingerprints) ||
    !s.submittedAt || typeof s.submittedAt !== "object" || Array.isArray(s.submittedAt) ||
    Object.entries(s.fingerprints).some(([, hash]) => typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) ||
    Object.values(s.submittedAt).some((time) => typeof time !== "string" || !Number.isFinite(Date.parse(time)))) {
    throw new Error("Invalid IndexNow state; refusing to reset submission history");
  }
  if (!s.fingerprints[`${INDEXNOW_ORIGIN}/`] || !s.fingerprints[`${INDEXNOW_ORIGIN}/en`]) throw new Error("IndexNow state is missing its homepage baseline");
  for (const url of [...Object.keys(s.fingerprints), ...Object.keys(s.submittedAt)]) assertIndexNowUrl(url);
  return s;
}

async function jsonFile(file: string) {
  try {
    const bytes = await readFile(file);
    if (bytes.length > 16 * 1024 * 1024) throw new Error("IndexNow state exceeds the size limit");
    return JSON.parse(bytes.toString("utf8")) as unknown;
  }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
}

async function saveJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, JSON.stringify(value, null, 2) + "\n");
  await rename(`${file}.tmp`, file);
}

export async function assertIndexNowTarget(sourceSha: string, version: string, fetchImpl: typeof fetch = fetch) {
  const options = { cache: "no-store" as const, redirect: "error" as const, signal: AbortSignal.timeout(15_000) };
  const marker = await fetchImpl(`${INDEXNOW_ORIGIN}/indexnow-deployment.json?source=${sourceSha}`, options);
  const current = await fetchImpl(`${PAGES}/current.json?indexnow=verify`, options);
  if (!marker.ok || !current.ok || (await marker.json() as { sourceSha?: string }).sourceSha !== sourceSha ||
    parseCrawlDataManifest(await current.json()).version !== version) {
    throw new Error("Production changed during verification; retry with a fresh snapshot");
  }
}

export async function verifyIndexNowProduction(
  sourceSha: string, manifest: CrawlDataManifest, urls: string[], next: IndexNowSnapshot, key: string,
  { fetchImpl = fetch, sleep = delay, now = Date.now, observedAt = now(), pagesChanged = true }: Dependencies = {},
) {
  const request = (url: string) => fetchImpl(url, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "SYU-CAMPUS-IndexNow/1.0" } });
  const markerUrl = `${INDEXNOW_ORIGIN}/indexnow-deployment.json?source=${sourceSha}`;
  const markerMatches = async () => {
    const response = await request(markerUrl);
    return response.status === 200 && (await response.json() as { sourceSha?: string }).sourceSha === sourceSha;
  };
  let ready = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    try { ready = await markerMatches(); } catch { ready = false; }
    if (ready) break;
    if (attempt < 19) await sleep(30_000);
  }
  if (!ready) throw new Error("Production source SHA did not become ready; nothing submitted");
  const keyResponse = await request(INDEXNOW_KEY_LOCATION);
  if (keyResponse.status !== 200 || (await keyResponse.text()).trim() !== key) throw new Error("Production IndexNow key file does not match");
  // A rollback keeps its old publishedAt; use when this active version was observed.
  const settle = pagesChanged ? observedAt + CACHE_SETTLE_MS - now() : 0;
  if (!Number.isFinite(settle) || settle > CACHE_SETTLE_MS + 60_000) throw new Error("Invalid Pages observation time");
  if (settle > 0) await sleep(settle);
  for (const file of Object.keys(manifest.files)) {
    let matched = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      const response = await request(`${INDEXNOW_ORIGIN}/api/crawl-data/${file}?indexnow=${manifest.version}&attempt=${attempt}`);
      matched = response.status === 200 && response.headers.get("x-crawl-data-source") === "github-pages" && response.headers.get("x-crawl-data-version") === manifest.version;
      await response.body?.cancel();
      if (matched) break;
      if (attempt < 7) await sleep(15_000);
    }
    if (!matched) throw new Error(`Production data version is not ready: ${file}`);
  }
  // Sample each dynamic template and check every changed static page without crawling the archive.
  const probes = new Map<string, string>();
  for (const url of urls) {
    const key = new URL(url).pathname.replace(/\/announcements\/(academic|campus|scholarship|sw)\/[^/]+$/, "/announcements/$1/[id]")
      .replace(/\/service\/notices\/[^/]+$/, "/service/notices/[slug]") + (next[url] ? ":present" : ":removed");
    if (!probes.has(key)) probes.set(key, url);
  }
  for (const url of probes.values()) {
    const response = await request(url);
    const html = new TextDecoder().decode(await readResponseBytes(response, 12 * 1024 * 1024, "IndexNow page probe"));
    const removed = !next[url];
    const noindex = /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(html);
    const gone = [301, 302, 307, 308, 404, 410].includes(response.status) || (response.status === 200 && noindex);
    const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/)?.[1];
    // Next metadata renders the homepage canonical without the root slash.
    const canonicalMatches = canonical === url || (url === `${INDEXNOW_ORIGIN}/` && canonical === INDEXNOW_ORIGIN);
    if (removed ? !gone : response.status !== 200 || !canonicalMatches || noindex) {
      throw new Error(`Production page does not reflect the expected change (status=${response.status}, canonicalMatches=${canonicalMatches}, noindex=${noindex})`);
    }
  }
  await assertIndexNowTarget(sourceSha, manifest.version, fetchImpl);
  return [...probes.values()];
}

async function collectFiles(fetchImpl: typeof fetch, send: boolean) {
  if (send && (await git("git", ["status", "--porcelain"])).stdout.trim()) throw new Error("IndexNow --send requires a clean committed checkout");
  const { stdout: source } = await git("git", ["rev-parse", "HEAD"]);
  const { stdout: listing } = await git("git", ["ls-files", "-s", "-z"], { maxBuffer: 8 * 1024 * 1024 });
  const files: Record<string, SnapshotFile> = {};
  for (const entry of listing.split("\0").filter(Boolean)) {
    const match = entry.match(/^\d+ ([a-f0-9]{40}) 0\t(.+)$/s);
    if (!match) throw new Error("Cannot read tracked source files");
    const [, hash, file] = match;
    files[file] = { hash };
    if (/^public\/data\/[^/]+\.json$/.test(file)) files[file].data = JSON.parse(await readFile(file, "utf8"));
  }
  const response = await fetchImpl(`${PAGES}/current.json?indexnow=snapshot`, { cache: "no-store", signal: AbortSignal.timeout(15_000), redirect: "error" });
  if (!response.ok) throw new Error(`Pages manifest HTTP ${response.status}`);
  const manifest = parseCrawlDataManifest(JSON.parse(new TextDecoder().decode(await readResponseBytes(response, 64 * 1024, "IndexNow manifest"))));
  const observedAt = Date.now();
  for (const [file, descriptor] of Object.entries(manifest.files)) {
    const response = await fetchImpl(`${PAGES}/${descriptor.path}`, { cache: "no-store", signal: AbortSignal.timeout(15_000), redirect: "error" });
    if (!response.ok) throw new Error(`Pages data HTTP ${response.status}: ${file}`);
    const bytes = await readResponseBytes(response, CRAWL_DATA_MAX_BYTES[file as keyof typeof CRAWL_DATA_MAX_BYTES], file);
    if (bytes.byteLength !== descriptor.size || createHash("sha256").update(bytes).digest("hex") !== descriptor.sha256) throw new Error(`Pages data hash mismatch: ${file}`);
    const data = JSON.parse(new TextDecoder().decode(bytes));
    validateDailyCrawlData(file as keyof typeof CRAWL_DATA_MAX_BYTES, data);
    files[`public/data/${file}`] = {
      hash: descriptor.sha256, data,
      stale: manifest.sourceHealth?.[file as keyof typeof manifest.files]?.status === "stale",
    };
  }
  return { sourceSha: source.trim(), manifest, observedAt, fingerprints: buildIndexNowSnapshot(files) };
}

export async function processIndexNowSnapshot(
  target: { sourceSha: string; manifest: CrawlDataManifest; fingerprints: IndexNowSnapshot }, previous: State | undefined,
  { send, key, saveState, verify, assertCurrent, onProgress, submit = submitIndexNow, now = Date.now, sleep = delay }: {
    send: boolean; key: string; saveState: (state: State) => Promise<void>; verify: () => Promise<string[]>;
    assertCurrent?: () => Promise<void>; onProgress?: (report: Report) => void;
    submit?: typeof submitIndexNow; now?: () => number; sleep?: (ms: number) => Promise<void>;
  },
): Promise<Report> {
  const changed = previous ? changedIndexNowUrls(previous.fingerprints, target.fingerprints) : [];
  const report: Report = { mode: send ? previous ? "send" : "baseline" : "dry-run", sourceSha: target.sourceSha, version: target.manifest.version, tracked: Object.keys(target.fingerprints).length, changed, probes: [], accepted: 0, pendingValidation: 0 };
  onProgress?.(report);
  if (!send) return report;
  if (previous && changed.length === 0) {
    report.mode = "unchanged";
    await saveState(previous);
    return report;
  }
  const state: State = previous ? structuredClone(previous) : { schemaVersion: 1, sourceSha: target.sourceSha, version: target.manifest.version, fingerprints: { ...target.fingerprints }, submittedAt: {} };
  for (const [url, time] of Object.entries(state.submittedAt)) if (now() - Date.parse(time) > 24 * 60 * 60 * 1000) delete state.submittedAt[url];
  if (changed.length) {
    const wait = Math.max(0, ...changed.map((url) => Date.parse(state.submittedAt[url] ?? "1970-01-01") + 5 * 60 * 1000 - now()));
    if (wait > 5 * 60 * 1000) throw new Error("Invalid future IndexNow submission history");
    if (wait > 0) await sleep(wait);
  }
  report.probes = await verify();
  if (changed.length) {
    await submit(changed, key, { now, sleep, beforeAttempt: assertCurrent, onAccepted: async (batch, status) => {
      for (const url of batch) {
        if (target.fingerprints[url]) state.fingerprints[url] = target.fingerprints[url];
        else delete state.fingerprints[url];
        state.submittedAt[url] = new Date(now()).toISOString();
      }
      if (status === 200) report.accepted += batch.length; else report.pendingValidation += batch.length;
      await saveState(state);
    } });
  }
  state.sourceSha = target.sourceSha;
  state.version = target.manifest.version;
  await saveState(state);
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const options = { stateFile: ".cache/indexnow/state.json", reportFile: ".cache/indexnow/report.json", send: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--send") options.send = true;
    else if (["--state-file", "--report-file"].includes(args[i]) && args[i + 1]) options[args[i] === "--state-file" ? "stateFile" : "reportFile"] = args[++i];
    else throw new Error(`Unknown IndexNow argument: ${args[i]}`);
  }
  let report: Partial<Report> = { mode: options.send ? "send" : "dry-run" };
  try {
    const stored = await jsonFile(options.stateFile);
    const previous = stored === undefined ? undefined : parseIndexNowState(stored);
    const target = await collectFiles(fetch, options.send);
    const key = (await readFile("public/indexnow-key.txt", "utf8")).trim();
    const changed = previous ? changedIndexNowUrls(previous.fingerprints, target.fingerprints) : [];
    report = { ...report, sourceSha: target.sourceSha, version: target.manifest.version, changed };
    report = await processIndexNowSnapshot(target, previous, { send: options.send, key, saveState: (state) => saveJson(options.stateFile, state),
      assertCurrent: () => assertIndexNowTarget(target.sourceSha, target.manifest.version), onProgress: (progress) => { report = progress; },
      verify: () => verifyIndexNowProduction(target.sourceSha, target.manifest, changed, target.fingerprints, key, { observedAt: target.observedAt, pagesChanged: previous?.version !== target.manifest.version }) });
    console.info(`[IndexNow] ${report.mode}: ${report.tracked} tracked, ${changed.length} changed URL(s), ${report.accepted} accepted, ${report.pendingValidation} pending key validation. This does not confirm indexing.`);
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally { await saveJson(options.reportFile, report); }
}

if (typeof require !== "undefined" && require.main === module) main().catch((error) => { console.error("[IndexNow] failed:", error); process.exitCode = 1; });
