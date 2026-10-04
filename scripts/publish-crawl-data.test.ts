// @vitest-environment node
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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
