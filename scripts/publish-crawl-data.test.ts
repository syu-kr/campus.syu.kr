// @vitest-environment node
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DAILY_CRAWL_DATA_FILES,
  parseCrawlDataManifest,
  type CrawlDataManifest,
  type CrawlSourceHealth,
} from "../lib/crawl-data-contract";
import {
  buildLocalSnapshot,
  manifestsHaveSameFiles,
  preparePagesArtifact,
  prepareRollbackArtifact,
  pullCurrent,
} from "./publish-crawl-data";

vi.mock("node:timers/promises", () => ({ setTimeout: vi.fn(async () => {}) }));

let root: string;
let dataDir: string;
let healthPath: string;
let remote: Map<string, Buffer>;
const fresh: CrawlSourceHealth = {
  status: "fresh",
  lastAttemptAt: "2026-10-04T00:00:00.000Z",
  lastSuccessAt: "2026-10-04T00:00:00.000Z",
};
const stale: CrawlSourceHealth = {
  status: "stale",
  lastAttemptAt: "2026-10-04T00:00:00.000Z",
  lastSuccessAt: "2026-10-03T00:00:00.000Z",
  errorCode: "INCOMPLETE_SOURCE",
};

beforeEach(async () => {
  vi.clearAllMocks();
  root = await mkdtemp(path.join(os.tmpdir(), "syu-crawl-health-"));
  dataDir = path.join(root, "data");
  healthPath = path.join(root, ".cache", "crawl-data-health.json");
  await mkdir(dataDir);
  await mkdir(path.dirname(healthPath));
  for (const fileName of DAILY_CRAWL_DATA_FILES) {
    const data = fileName.startsWith("announcements-") ? [] :
      fileName === "cafeteria-menu.json" ? {
        id: "fixture-cafeteria", name: "Fixture", weekStart: "2026-09-28",
        lastUpdated: "2026-10-04T00:00:00.000Z", menus: [],
      } : fileName === "public-holidays.json" ? {
        schemaVersion: 1, sourceUrl: "https://www.data.go.kr/data/15012690/openapi.do",
        lastSuccessAt: "2026-10-04T00:00:00.000Z", years: [2026, 2027],
        holidays: [{ date: "2026-10-09", names: ["한글날"] }],
      } : { version: 1, generatedAt: "2026-10-04T00:00:00.000Z", items: {} };
    await writeFile(path.join(dataDir, fileName), JSON.stringify(data));
  }
  remote = new Map();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-04T00:00:00.000Z"));
  vi.stubEnv("CRAWL_DATA_BASE_URL", "https://fixture.invalid/crawl-data");
  vi.stubEnv("GITHUB_RUN_ID", "fixture");
  vi.stubEnv("GITHUB_OUTPUT", path.join(root, "github-output"));
  vi.stubGlobal("fetch", vi.fn(async (input: URL) => {
    const pathname = new URL(input).pathname.replace(/^\/crawl-data\//, "");
    const payload = remote.get(pathname);
    return new Response(payload ? new Uint8Array(payload) : null, { status: payload ? 200 : 404 });
  }));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  await rm(root, { recursive: true, force: true });
});

async function cacheHealth(files: CrawlDataManifest["sourceHealth"]) {
  await writeFile(healthPath, JSON.stringify({ files }));
}

async function fixtureManifest(version: string, sourceHealth?: CrawlDataManifest["sourceHealth"]) {
  const snapshot = await buildLocalSnapshot(dataDir, path.join(root, "missing-health.json"));
  const manifest = parseCrawlDataManifest({
    ...snapshot.manifest,
    version,
    retainedVersions: [version],
    files: Object.fromEntries(Object.entries(snapshot.manifest.files).map(([fileName, entry]) => [
      fileName, { ...entry, path: `versions/${version}/${fileName}` },
    ])),
    ...(sourceHealth ? { sourceHealth } : {}),
  });
  remote.set(`versions/${version}/manifest.json`, Buffer.from(JSON.stringify(manifest)));
  for (const [fileName, payload] of snapshot.payloads) {
    remote.set(`versions/${version}/${fileName}`, payload);
  }
  return manifest;
}

describe("crawler health publication", () => {
  it("retries a transient Pages 503 on the same immutable AI file", async () => {
    const manifest = await fixtureManifest("pages-retry", { "cafeteria-menu.json": stale });
    remote.set("current.json", Buffer.from(JSON.stringify(manifest)));
    const fetchMock = vi.mocked(fetch);
    const original = fetchMock.getMockImplementation()!;
    const target = "/crawl-data/versions/pages-retry/announcement-ai-metadata.json";
    let attempts = 0;
    fetchMock.mockImplementation(async (input, init) => {
      if (new URL(String(input)).pathname === target && ++attempts < 3) {
        return new Response(null, { status: 503 });
      }
      return original(input, init);
    });

    await pullCurrent(dataDir, healthPath);

    expect(attempts).toBe(3);
    expect(vi.mocked(delay).mock.calls.map(([milliseconds]) => milliseconds)).toEqual([1000, 2000]);
    expect(JSON.parse(await readFile(healthPath, "utf8"))).toEqual({ files: manifest.sourceHealth });
    expect(await readFile(path.join(dataDir, "announcement-ai-metadata.json"))).toEqual(remote.get(target.replace("/crawl-data/", "")));
  });

  it.each(["fetch", "body"])("retries a %s download failure before restoring data", async (stage) => {
    const manifest = await fixtureManifest("interrupted");
    remote.set("current.json", Buffer.from(JSON.stringify(manifest)));
    const fetchMock = vi.mocked(fetch);
    const original = fetchMock.getMockImplementation()!;
    let attempts = 0;
    fetchMock.mockImplementation(async (input, init) => {
      if (new URL(String(input)).pathname.endsWith("/current.json") && ++attempts === 1) {
        if (stage === "fetch") throw new DOMException("request timed out", "TimeoutError");
        const response = new Response("partial", { status: 200 });
        vi.spyOn(response, "arrayBuffer").mockRejectedValue(new TypeError("connection closed"));
        return response;
      }
      return original(input, init);
    });

    await pullCurrent(dataDir, healthPath);

    expect(attempts).toBe(2);
    expect(delay).toHaveBeenCalledExactlyOnceWith(1000);
  });

  it("stops after three failed downloads without changing any data or health", async () => {
    await cacheHealth({ "cafeteria-menu.json": fresh });
    const manifest = await fixtureManifest("unavailable", { "cafeteria-menu.json": stale });
    remote.set("current.json", Buffer.from(JSON.stringify(manifest)));
    const baselines = await Promise.all(DAILY_CRAWL_DATA_FILES.map((fileName) => readFile(path.join(dataDir, fileName))));
    const healthBaseline = await readFile(healthPath);
    const fetchMock = vi.mocked(fetch);
    const original = fetchMock.getMockImplementation()!;
    let attempts = 0;
    fetchMock.mockImplementation(async (input, init) => {
      if (new URL(String(input)).pathname.endsWith("/announcement-ai-metadata.json")) {
        attempts++;
        return new Response(null, { status: 503 });
      }
      return original(input, init);
    });

    await expect(pullCurrent(dataDir, healthPath)).rejects.toThrow("응답 오류: 503");

    expect(attempts).toBe(3);
    expect(await Promise.all(DAILY_CRAWL_DATA_FILES.map((fileName) => readFile(path.join(dataDir, fileName))))).toEqual(baselines);
    expect(await readFile(healthPath)).toEqual(healthBaseline);
  });

  it("does not retry invalid manifests or bypass verification", async () => {
    remote.set("current.json", Buffer.from(JSON.stringify({ schemaVersion: 999 })));
    await expect(pullCurrent(dataDir, healthPath)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });

  it("keeps the first-publication fallback for a genuine current.json 404", async () => {
    await cacheHealth({ "cafeteria-menu.json": stale });
    const baseline = await readFile(path.join(dataDir, "cafeteria-menu.json"));

    await pullCurrent(dataDir, healthPath);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
    expect(await readFile(path.join(dataDir, "cafeteria-menu.json"))).toEqual(baseline);
    expect(JSON.parse(await readFile(healthPath, "utf8"))).toEqual({ files: {} });
  });

  it("restores verified health on pull and includes it in the local snapshot", async () => {
    const sourceHealth = { "cafeteria-menu.json": stale };
    const manifest = await fixtureManifest("verified", sourceHealth);
    remote.set("current.json", Buffer.from(JSON.stringify(manifest)));

    await pullCurrent(dataDir, healthPath);

    expect(JSON.parse(await readFile(healthPath, "utf8"))).toEqual({ files: sourceHealth });
    expect((await buildLocalSnapshot(dataDir, healthPath)).manifest.sourceHealth).toEqual(sourceHealth);
  });

  it("clears previous health for a legacy manifest without inferring publication as success", async () => {
    await cacheHealth({ "cafeteria-menu.json": fresh });
    const manifest = await fixtureManifest("legacy");
    remote.set("current.json", Buffer.from(JSON.stringify(manifest)));

    await pullCurrent(dataDir, healthPath);

    expect(JSON.parse(await readFile(healthPath, "utf8"))).toEqual({ files: {} });
    expect((await buildLocalSnapshot(dataDir, healthPath)).manifest.sourceHealth).toBeUndefined();
  });

  it("keeps bundled holidays on a legacy pull and retains old versions without that optional file", async () => {
    const manifest = await fixtureManifest("legacy-holidays");
    delete manifest.files["public-holidays.json"];
    remote.set("current.json", Buffer.from(JSON.stringify(manifest)));
    remote.set("versions/legacy-holidays/manifest.json", Buffer.from(JSON.stringify(manifest)));
    remote.delete("versions/legacy-holidays/public-holidays.json");
    const holidayBaseline = await readFile(path.join(dataDir, "public-holidays.json"));

    await pullCurrent(dataDir, healthPath);
    expect(await readFile(path.join(dataDir, "public-holidays.json"))).toEqual(holidayBaseline);
    const outputDir = path.join(root, "legacy-transition");
    await preparePagesArtifact(outputDir, dataDir, healthPath);
    const current = parseCrawlDataManifest(JSON.parse(await readFile(path.join(outputDir, "crawl-data", "current.json"), "utf8")));
    expect(current.files["public-holidays.json"]).toBeDefined();
    expect(current.retainedVersions).toContain("legacy-holidays");
    const retained = parseCrawlDataManifest(JSON.parse(await readFile(path.join(outputDir, "crawl-data", "versions", "legacy-holidays", "manifest.json"), "utf8")));
    expect(retained.files["public-holidays.json"]).toBeUndefined();
  });

  it("verifies holiday hashes before replacing any current local bytes", async () => {
    const holidayBaseline = await readFile(path.join(dataDir, "public-holidays.json"));
    const manifest = await fixtureManifest("corrupt-holidays");
    remote.set("current.json", Buffer.from(JSON.stringify(manifest)));
    remote.set("versions/corrupt-holidays/public-holidays.json", Buffer.from("corrupt"));

    await expect(pullCurrent(dataDir, healthPath)).rejects.toThrow("manifest와 일치하지 않습니다");
    expect(await readFile(path.join(dataDir, "public-holidays.json"))).toEqual(holidayBaseline);
  });

  it("gates new holiday health until compatible app deployment while preserving the cached health", async () => {
    await cacheHealth({ "public-holidays.json": fresh, "cafeteria-menu.json": stale });
    vi.stubEnv("PUBLIC_HOLIDAYS_ENABLED", "");
    const gated = await buildLocalSnapshot(dataDir, healthPath);
    expect(gated.manifest.files["public-holidays.json"]).toBeDefined();
    expect(gated.manifest.sourceHealth).toEqual({ "cafeteria-menu.json": stale });
    expect(JSON.parse(await readFile(healthPath, "utf8")).files["public-holidays.json"]).toEqual(fresh);
    vi.stubEnv("PUBLIC_HOLIDAYS_ENABLED", "true");
    expect((await buildLocalSnapshot(dataDir, healthPath)).manifest.sourceHealth).toEqual({
      "public-holidays.json": fresh, "cafeteria-menu.json": stale,
    });
  });

  it("does not restore health when a downloaded file fails verification", async () => {
    await cacheHealth({ "cafeteria-menu.json": fresh });
    const manifest = await fixtureManifest("corrupt", { "cafeteria-menu.json": stale });
    remote.set("current.json", Buffer.from(JSON.stringify(manifest)));
    remote.set("versions/corrupt/cafeteria-menu.json", Buffer.from("corrupt"));

    await expect(pullCurrent(dataDir, healthPath)).rejects.toThrow("manifest와 일치하지 않습니다");
    expect(JSON.parse(await readFile(healthPath, "utf8"))).toEqual({ files: { "cafeteria-menu.json": fresh } });
  });

  it.each([[fresh, stale], [stale, fresh]])("publishes health-only changes and preserves retained health", async (previous, next) => {
    const manifest = await fixtureManifest("previous", { "cafeteria-menu.json": previous });
    remote.set("current.json", Buffer.from(JSON.stringify(manifest)));
    await cacheHealth({ "cafeteria-menu.json": next });
    const outputDir = path.join(root, "artifact");

    await preparePagesArtifact(outputDir, dataDir, healthPath);

    const current = parseCrawlDataManifest(JSON.parse(await readFile(path.join(outputDir, "crawl-data", "current.json"), "utf8")));
    expect(current.sourceHealth).toEqual({ "cafeteria-menu.json": next });
    expect(current.version).not.toBe("previous");
    expect(current.retainedVersions).toContain("previous");
    const retained = parseCrawlDataManifest(JSON.parse(await readFile(path.join(outputDir, "crawl-data", "versions", "previous", "manifest.json"), "utf8")));
    expect(retained.sourceHealth).toEqual({ "cafeteria-menu.json": previous });
    expect(await readFile(path.join(root, "github-output"), "utf8")).toContain("changed=true");
  });

  it("skips publishing unchanged files and health", async () => {
    const manifest = await fixtureManifest("unchanged", { "cafeteria-menu.json": fresh });
    remote.set("current.json", Buffer.from(JSON.stringify(manifest)));
    await cacheHealth({ "cafeteria-menu.json": fresh });
    const next = await buildLocalSnapshot(dataDir, healthPath);
    expect(manifestsHaveSameFiles(manifest, next.manifest)).toBe(true);

    await preparePagesArtifact(path.join(root, "unused-artifact"), dataDir, healthPath);

    expect(await readFile(path.join(root, "github-output"), "utf8")).toContain("changed=false");
  });

  it("preserves source health when rolling back to a retained version", async () => {
    const older = await fixtureManifest("older", { "cafeteria-menu.json": stale });
    const newer = await fixtureManifest("newer", { "cafeteria-menu.json": fresh });
    remote.set("current.json", Buffer.from(JSON.stringify({ ...newer, retainedVersions: ["newer", "older"] })));
    const outputDir = path.join(root, "rollback");

    await prepareRollbackArtifact("older", outputDir);

    const current = parseCrawlDataManifest(JSON.parse(await readFile(path.join(outputDir, "crawl-data", "current.json"), "utf8")));
    expect(current.version).toBe("older");
    expect(current.sourceHealth).toEqual(older.sourceHealth);
    const retained = parseCrawlDataManifest(JSON.parse(await readFile(path.join(outputDir, "crawl-data", "versions", "newer", "manifest.json"), "utf8")));
    expect(retained.sourceHealth).toEqual(newer.sourceHealth);
  });

  it("rejects malformed local health instead of publishing guessed freshness", async () => {
    await cacheHealth({ "cafeteria-menu.json": { ...fresh, errorCode: "CRAWLER_FAILED" } });
    await expect(buildLocalSnapshot(dataDir, healthPath)).rejects.toThrow("출처 상태가");
  });
});
