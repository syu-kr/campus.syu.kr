import { beforeAll, describe, expect, it } from "vitest";
import { buildPublicDataSnapshot, ownedPublicDataUnchanged, publicDataLocalPath } from "../../scripts/public-data-snapshot";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DAILY_CRAWL_DATA_FILES } from "../crawl-data-contract";
import { readHealthCache, writeHealthCache } from "../../scripts/publish-crawl-data";
import { parsePublicDataManifest, PUBLIC_DATA_FILES, validatePublicData, type PublicDataManifest } from "../public-data-snapshot";
import { activatePublicSnapshot, readPublicSnapshotFile, readStoredPublicManifest, uploadPublicSnapshot, type ActivePublicData, type PublicDataStore } from "./public-data-storage";

let fixture: Awaited<ReturnType<typeof buildPublicDataSnapshot>>;
beforeAll(async () => { fixture = await buildPublicDataSnapshot("public", "test-snapshot"); });
function memoryStore() {
  let active: ActivePublicData | null = null;
  const objects = new Map<string, Buffer>();
  const store: PublicDataStore = {
    async readActive() { return active; },
    async readObject(key, max) { const bytes = objects.get(key); if (!bytes || bytes.length > max) throw new Error("Missing or oversized object"); return bytes; },
    async createObject(key, bytes) { if (objects.has(key)) throw Object.assign(new Error("exists"), { code: 412 }); objects.set(key, bytes); },
    async compareAndSet(expected, manifest) { if ((active?.revision ?? null) !== expected) throw new Error("conflict"); active = { manifest, revision: (expected ?? 0) + 1 }; },
  };
  return { store, objects };
}
describe("Firebase public snapshots", () => {
  it("validates every current public file without changing its bytes", () => {
    expect(fixture.payloads.size).toBe(22);
    expect(PUBLIC_DATA_FILES).toHaveLength(23);
    for (const [file, bytes] of fixture.payloads) expect(() => validatePublicData(file, JSON.parse(bytes.toString()))).not.toThrow();
    const requirements = JSON.parse(fixture.payloads.get("graduation-requirements-2026.json")!.toString());
    expect(requirements.requirementProfiles.some((profile: { totalCredits: number }) => profile.totalCredits === 0)).toBe(true);
  });
  it("does not activate until every uploaded object is verified", async () => {
    const { store } = memoryStore();
    await uploadPublicSnapshot(store, fixture.manifest, fixture.payloads);
    expect(await store.readActive()).toBeNull();
    await activatePublicSnapshot(store, fixture.manifest, null);
    expect((await store.readActive())?.manifest.version).toBe("test-snapshot");
    expect(await readStoredPublicManifest(store, "test-snapshot")).toEqual(fixture.manifest);
    expect(await readPublicSnapshotFile(store, fixture.manifest, "phone-numbers.json")).toEqual(JSON.parse(fixture.payloads.get("phone-numbers.json")!.toString()));
  });
  it("can resume identical immutable uploads and refuses overwrite", async () => {
    const { store } = memoryStore();
    await uploadPublicSnapshot(store, fixture.manifest, fixture.payloads);
    await uploadPublicSnapshot(store, fixture.manifest, fixture.payloads);
    const changed = structuredClone(fixture.manifest); changed.publishedAt = "2026-01-01T00:00:00.000Z";
    await expect(uploadPublicSnapshot(store, changed, fixture.payloads)).rejects.toThrow("immutable");
    expect(await store.readActive()).toBeNull();
  });
  it("does not activate partial, corrupted or conflicting snapshots", async () => {
    const { store, objects } = memoryStore();
    await expect(activatePublicSnapshot(store, fixture.manifest, null)).rejects.toThrow();
    await uploadPublicSnapshot(store, fixture.manifest, fixture.payloads);
    const file = fixture.manifest.files["phone-numbers.json"]!;
    objects.set(file.path, Buffer.from("[]"));
    await expect(activatePublicSnapshot(store, fixture.manifest, null)).rejects.toThrow("integrity");
    expect(await store.readActive()).toBeNull();
    objects.set(file.path, fixture.payloads.get("phone-numbers.json")!);
    await activatePublicSnapshot(store, fixture.manifest, null);
    await expect(activatePublicSnapshot(store, fixture.manifest, null)).rejects.toThrow("conflict");
  });
  it("preserves all unowned files during daily publication", async () => {
    const { store } = memoryStore();
    await uploadPublicSnapshot(store, fixture.manifest, fixture.payloads);
    await activatePublicSnapshot(store, fixture.manifest, null);
    const next = await buildPublicDataSnapshot("public", "next-snapshot", await store.readActive(), store, "daily");
    expect(next.manifest.files["graduation-requirements-2026.json"]?.sha256).toBe(fixture.manifest.files["graduation-requirements-2026.json"]?.sha256);
    expect(next.manifest.retainedVersions).toEqual(["next-snapshot", "test-snapshot"]);
    expect(await ownedPublicDataUnchanged("public", "reference", (await store.readActive())!)).toBe(true);
  });
  it("publishes only the collector's menu and preserves all 22 files and daily health", async () => {
    const { store } = memoryStore();
    const baseline: PublicDataManifest = structuredClone(fixture.manifest);
    baseline.sourceHealth = Object.fromEntries(DAILY_CRAWL_DATA_FILES.map(file => [file, {
      status: "fresh" as const, lastAttemptAt: "2026-10-25T00:00:00Z", lastSuccessAt: "2026-10-25T00:00:00Z",
    }]));
    baseline.sourceHealth["public-holidays.json"] = {
      status: "stale", lastAttemptAt: "2026-10-25T00:00:00Z", lastSuccessAt: "2026-10-24T00:00:00Z", errorCode: "CRAWLER_FAILED",
    };
    await uploadPublicSnapshot(store, baseline, fixture.payloads);
    await activatePublicSnapshot(store, baseline, null);
    const previous = (await store.readActive())!;
    const base = await mkdtemp(path.join(tmpdir(), "public-menu-snapshot-"));
    const directory = path.join(base, "public");
    const oldMenu = { updatedAt: "2026-10-19T00:00:00Z", weekStart: "2026-10-19", days: [] };
    const newMenu = { ...oldMenu, updatedAt: "2026-10-20T00:00:00Z", days: [{ date: "2026-10-20", breakfast: ["new menu"], lunch: null, dinner: null }] };
    try {
      await mkdir(path.join(directory, "data"), { recursive: true }); await mkdir(path.join(directory, "cafeteria"));
      await writeFile(path.join(directory, "data", "student-restaurant-1.json"), JSON.stringify(oldMenu));
      await writeFile(publicDataLocalPath(directory, "student-restaurant-1.json"), JSON.stringify(newMenu));
      await writeFile(publicDataLocalPath(directory, "phone-numbers.json"), "invalid unowned local input");
      await writeHealthCache(path.join(base, ".cache", "crawl-data-health.json"), {});
      const next = await buildPublicDataSnapshot(directory, "cafeteria-next", previous, store, "student-restaurant");
      expect(next.payloads.size).toBe(23);
      expect(JSON.parse(next.payloads.get("student-restaurant-1.json")!.toString())).toEqual(newMenu);
      expect(publicDataLocalPath(directory, "student-restaurant-1.json")).toBe(path.join(directory, "cafeteria", "student-restaurant-1.json"));
      const preserved = PUBLIC_DATA_FILES.filter(file => file !== "student-restaurant-1.json");
      expect(preserved).toHaveLength(22);
      for (const file of preserved) {
        expect(next.payloads.get(file)?.equals(fixture.payloads.get(file)!), file).toBe(true);
        expect(next.manifest.files[file]?.sha256).toBe(baseline.files[file]?.sha256);
        expect(next.manifest.files[file]?.size).toBe(baseline.files[file]?.size);
      }
      expect(next.manifest.sourceHealth).toEqual(baseline.sourceHealth);
      expect(Object.keys(next.manifest.sourceHealth)).toHaveLength(9);
      await uploadPublicSnapshot(store, next.manifest, next.payloads);
      await activatePublicSnapshot(store, next.manifest, previous);
      expect(await ownedPublicDataUnchanged(directory, "student-restaurant", (await store.readActive())!)).toBe(true);
    } finally {
      if (!path.resolve(base).startsWith(path.resolve(tmpdir()) + path.sep) || !path.basename(base).startsWith("public-menu-snapshot-")) throw new Error("Unexpected temporary directory");
      await rm(base, { recursive: true, force: true });
    }
  });
  it("round-trips the crawler's wrapped health cache and preserves stale flags", async () => {
    const { store } = memoryStore();
    await uploadPublicSnapshot(store, fixture.manifest, fixture.payloads);
    await activatePublicSnapshot(store, fixture.manifest, null);
    const base = await mkdtemp(path.join(tmpdir(), "public-menu-snapshot-"));
    const directory = path.join(base, "public");
    const health = { "announcements-academic.json": { status: "stale" as const, lastAttemptAt: "2026-10-25T14:59:07.788Z", lastSuccessAt: "2026-10-24T14:37:40.598Z", errorCode: "CRAWLER_FAILED" as const } };
    try {
      await mkdir(path.join(directory, "data"), { recursive: true });
      for (const [file, bytes] of fixture.payloads) await writeFile(publicDataLocalPath(directory, file), bytes);
      const healthPath = path.join(base, ".cache", "crawl-data-health.json");
      await writeHealthCache(healthPath, health);
      const next = await buildPublicDataSnapshot(directory, "health-next", await store.readActive(), store, "daily");
      expect(next.manifest.sourceHealth).toEqual(health);
      expect(await readHealthCache(healthPath)).toEqual(health);
      expect(await ownedPublicDataUnchanged(directory, "daily", (await store.readActive())!)).toBe(false);
      expect(await ownedPublicDataUnchanged(directory, "daily", { manifest: next.manifest, revision: 2 })).toBe(true);
    } finally {
      if (!path.resolve(base).startsWith(path.resolve(tmpdir()) + path.sep) || !path.basename(base).startsWith("public-menu-snapshot-")) throw new Error("Unexpected temporary directory");
      await rm(base, { recursive: true, force: true });
    }
  });
  it("rejects unknown files, traversal, missing entries and oversized objects", () => {
    const mutate = (run: (manifest: PublicDataManifest) => void) => { const value = structuredClone(fixture.manifest); run(value); return () => parsePublicDataManifest(value); };
    expect(mutate(value => { value.version = "../x"; })).toThrow();
    expect(mutate(value => { delete value.files["phone-numbers.json"]; })).toThrow();
    expect(mutate(value => { value.files["phone-numbers.json"]!.path = "private/secrets.json"; })).toThrow();
    expect(mutate(value => { value.files["phone-numbers.json"]!.size = 100 * 1024 * 1024; })).toThrow();
    expect(() => parsePublicDataManifest({ ...fixture.manifest, files: { ...fixture.manifest.files, "private.json": {} } })).toThrow();
  });
  it("rejects malformed curated records instead of casting arbitrary JSON", () => {
    expect(() => validatePublicData("phone-numbers.json", [{ department: "test" }])).toThrow();
    expect(() => validatePublicData("shuttle-bus-schedule.json", [{ id: "x", routeName: "x", schedules: { friday: ["99:99"] } }])).toThrow();
    expect(() => validatePublicData("graduation-requirements-2026.json", { metadata: {}, colleges: [], departments: [], requirementProfiles: [], aliases: {} })).toThrow();
    expect(() => validatePublicData("student-restaurant-1.json", { arbitrary: "text" })).toThrow();
  });
});
