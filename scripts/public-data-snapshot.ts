import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DAILY_CRAWL_DATA_FILES, validateCrawlDataVersion } from "../lib/crawl-data-contract";
import { readHealthCache, writeHealthCache } from "./publish-crawl-data";
import { PUBLIC_DATA_FILES, REFERENCE_DATA_FILES, parsePublicDataManifest, publicDataMaxBytes, publicDataPath, validatePublicData, type PublicDataFile, type PublicDataManifest } from "../lib/public-data-snapshot";
import { activatePublicSnapshot, firebasePublicDataStore, readPublicSnapshotFile, readStoredPublicManifest, uploadPublicSnapshot, type ActivePublicData, type PublicDataStore } from "../lib/server/public-data-storage";

type Scope = "all" | "daily" | "monthly" | "reference" | "student-restaurant";
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
function belongs(file: PublicDataFile, scope: Scope) {
  return scope === "all" || scope === "daily" && (DAILY_CRAWL_DATA_FILES as readonly string[]).includes(file) || scope === "reference" && (REFERENCE_DATA_FILES as readonly string[]).includes(file) || scope === "monthly" && ["phone-numbers.json", "schedules-major.json"].includes(file) || scope === "student-restaurant" && file === "student-restaurant-1.json";
}
async function readLocalPublicData(directory: string, file: PublicDataFile) {
  const candidates = file === "student-restaurant-1.json" ? [publicDataLocalPath(directory, file), path.join(directory, "data", file)] : [publicDataLocalPath(directory, file)];
  for (const candidate of candidates) {
    try { return await readFile(candidate); }
    catch (error) { if (!(typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")) throw error; }
  }
}
export function publicDataLocalPath(directory: string, file: PublicDataFile) { return path.join(directory, file === "student-restaurant-1.json" ? "cafeteria" : "data", file); }
export async function ownedPublicDataUnchanged(directory: string, scope: Scope, active: ActivePublicData) {
  for (const file of PUBLIC_DATA_FILES.filter(file => belongs(file, scope))) {
    const bytes = await readLocalPublicData(directory, file);
    if (!bytes && file === "student-restaurant-1.json") continue;
    if (!bytes) throw new Error(`Missing public data: ${file}`);
    if (bytes.length > publicDataMaxBytes(file)) throw new Error(`Public data exceeds size limit: ${file}`);
    validatePublicData(file, JSON.parse(bytes.toString("utf8")));
    if (hash(bytes) !== active.manifest.files[file]?.sha256) return false;
  }
  if (scope === "all" || scope === "daily") {
    const health = await readHealthCache(path.join(directory, "..", ".cache", "crawl-data-health.json"), active.manifest.sourceHealth);
    if (DAILY_CRAWL_DATA_FILES.some(file => JSON.stringify(health[file]) !== JSON.stringify(active.manifest.sourceHealth[file]))) return false;
  }
  return true;
}
export async function buildPublicDataSnapshot(directory: string, version: string, previous: ActivePublicData | null = null, store?: PublicDataStore, scope: Scope = "all") {
  validateCrawlDataVersion(version);
  const payloads = new Map<PublicDataFile, Buffer>();
  const files: PublicDataManifest["files"] = {};
  for (const file of PUBLIC_DATA_FILES) {
    let bytes: Buffer;
    if (previous?.manifest.files[file] && !belongs(file, scope)) {
      if (!store) throw new Error("A remote store is required to preserve existing public data");
      const entry = previous.manifest.files[file]!;
      bytes = await store.readObject(entry.path, publicDataMaxBytes(file));
      if (bytes.length !== entry.size || hash(bytes) !== entry.sha256) throw new Error(`Previous public data failed integrity: ${file}`);
    } else {
      let local = await readLocalPublicData(directory, file);
      if (!local && file === "student-restaurant-1.json") {
        const entry = previous?.manifest.files[file];
        if (!entry) continue;
        if (!store) throw new Error("A remote store is required to preserve the cafeteria menu");
        local = await store.readObject(entry.path, publicDataMaxBytes(file));
        if (local.length !== entry.size || hash(local) !== entry.sha256) throw new Error("Previous cafeteria menu failed integrity");
      }
      if (!local) throw new Error(`Missing public data: ${file}`);
      bytes = local;
    }
    if (bytes.length > publicDataMaxBytes(file)) throw new Error(`Public data exceeds size limit: ${file}`);
    validatePublicData(file, JSON.parse(bytes.toString("utf8")));
    payloads.set(file, bytes); files[file] = { path: publicDataPath(version, file), sha256: hash(bytes), size: bytes.length };
  }
  let sourceHealth = previous?.manifest.sourceHealth ?? {};
  if (scope === "all" || scope === "daily") {
    sourceHealth = await readHealthCache(path.join(directory, "..", ".cache", "crawl-data-health.json"), sourceHealth);
  }
  const manifest = parsePublicDataManifest({ schemaVersion: 1, version, publishedAt: new Date().toISOString(), files, retainedVersions: [version, ...(previous?.manifest.retainedVersions ?? []).filter(item => item !== version)].slice(0, 7), sourceHealth });
  return { manifest, payloads };
}
function sameContents(a: PublicDataManifest, b: PublicDataManifest) {
  return PUBLIC_DATA_FILES.every(file => a.files[file]?.sha256 === b.files[file]?.sha256) && JSON.stringify(a.sourceHealth) === JSON.stringify(b.sourceHealth);
}
async function main() {
  const args = process.argv.slice(2);
  const modes = ["--dry-run", "--upload", "--publish", "--activate", "--rollback", "--verify", "--inspect", "--pull-current"];
  if (modes.filter(mode => args.includes(mode)).length > 1) throw new Error("Choose exactly one public data operation");
  const value = (flag: string) => { const index = args.indexOf(flag); if (index < 0) return undefined; const result = args[index + 1]; if (!result || result.startsWith("--")) throw new Error(`Missing value for ${flag}`); return result; };
  const directory = path.resolve(value("--source-dir") ?? "public");
  const scope = value("--scope") ?? "all";
  if (!["all", "daily", "monthly", "reference", "student-restaurant"].includes(scope)) throw new Error("Invalid public data scope");
  const apply = args.includes("--upload") || args.includes("--publish") || args.includes("--activate") || args.includes("--rollback") || args.includes("--pull-current");
  const remote = apply || args.includes("--verify") || args.includes("--inspect") || args.includes("--read-remote");
  const store = remote ? firebasePublicDataStore() : undefined;
  const active = store ? await store.readActive() : null;
  if (args.includes("--inspect")) { console.log(JSON.stringify({ version: active?.manifest.version ?? null, revision: active?.revision ?? null, files: active ? Object.keys(active.manifest.files).length : 0, retainedVersions: active?.manifest.retainedVersions ?? [] })); return; }
  if (args.includes("--verify")) {
    if (!active || !store) throw new Error("No active public snapshot");
    for (const file of Object.keys(active.manifest.files) as PublicDataFile[]) await readPublicSnapshotFile(store, active.manifest, file);
    console.log(JSON.stringify({ verified: true, version: active.manifest.version, files: Object.keys(active.manifest.files).length })); return;
  }
  if (args.includes("--pull-current")) {
    if (!active || !store) throw new Error("No active public snapshot");
    const payloads = new Map<string, Buffer>();
    for (const file of Object.keys(active.manifest.files) as PublicDataFile[]) {
      await readPublicSnapshotFile(store, active.manifest, file);
      payloads.set(file, await store.readObject(active.manifest.files[file]!.path, publicDataMaxBytes(file)));
    }
    for (const [file, bytes] of payloads) { const target = publicDataLocalPath(directory, file as PublicDataFile); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes); }
    await writeHealthCache(path.join(directory, "..", ".cache", "crawl-data-health.json"), active.manifest.sourceHealth);
    console.log(JSON.stringify({ restored: true, version: active.manifest.version, files: payloads.size })); return;
  }
  const activate = value("--activate") ?? value("--rollback");
  if (activate) {
    if (!store) throw new Error("Public data store required");
    const expected = value("--expected-current");
    if (expected === undefined || expected !== (active?.manifest.version ?? "none")) throw new Error("--expected-current must match the active version (or none)");
    if (args.includes("--rollback") && !active?.manifest.retainedVersions.includes(activate)) throw new Error("Rollback version is not retained");
    const manifest = await readStoredPublicManifest(store, activate);
    manifest.retainedVersions = [activate, ...(active?.manifest.retainedVersions ?? []).filter(version => version !== activate)].slice(0, 7);
    await activatePublicSnapshot(store, manifest, active);
    console.log(JSON.stringify({ activated: true, version: activate, previous: expected })); return;
  }
  if (args.includes("--publish") && active && await ownedPublicDataUnchanged(directory, scope as Scope, active)) {
    console.log(JSON.stringify({ dryRun: false, changed: false, activated: false, version: active.manifest.version, files: Object.keys(active.manifest.files).length })); return;
  }
  const version = value("--version") ?? `snapshot-${new Date().toISOString().replace(/[-:.]/g, "")}`;
  const snapshot = await buildPublicDataSnapshot(directory, version, active, store, scope as Scope);
  const report = { dryRun: !apply, files: snapshot.payloads.size, bytes: [...snapshot.payloads.values()].reduce((total, bytes) => total + bytes.length, 0), version, previous: active?.manifest.version ?? null, changed: !active || !sameContents(active.manifest, snapshot.manifest), entries: Object.fromEntries(Object.entries(snapshot.manifest.files).map(([file, entry]) => [file, { sha256: entry!.sha256, size: entry!.size }])) };
  if (apply && report.changed) {
    if (!store) throw new Error("Public data store required");
    await uploadPublicSnapshot(store, snapshot.manifest, snapshot.payloads);
    if (args.includes("--publish")) await activatePublicSnapshot(store, snapshot.manifest, active);
  }
  console.log(JSON.stringify({ ...report, activated: args.includes("--publish") && report.changed }));
}
if (require.main === module) main().catch(error => { console.error(error instanceof Error ? error.message : "Public data operation failed"); process.exitCode = 1; });
