// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PUBLIC_DATA_FILES, publicDataPath } from "../public-data-snapshot";

const db = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../firebaseAdmin", () => ({ initializeFirebaseAdmin: () => {} }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => ({ collection: () => ({ doc: () => ({ get: db.get }) }) }) }));
vi.mock("firebase-admin/storage", () => ({ getStorage: () => ({ bucket: () => ({}) }) }));

function document(version: string, revision: number) {
  return { exists: true, data: () => ({ revision, manifest: {
    schemaVersion: 1, version, publishedAt: "2026-10-30T00:00:00Z", retainedVersions: [version], sourceHealth: {},
    files: Object.fromEntries(PUBLIC_DATA_FILES.map(file => [file, { path: publicDataPath(version, file), sha256: "a".repeat(64), size: 1 }])),
  } }) };
}
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(0);
  vi.stubEnv("PUBLIC_DATA_STORAGE_BUCKET", "test-bucket");
  db.get.mockReset().mockResolvedValue(document("v1", 1));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

it("observes a replacement manifest at the existing thirty-second boundary", async () => {
  const { getActivePublicData } = await import("./public-data-storage");
  expect((await getActivePublicData()).manifest.version).toBe("v1");
  db.get.mockResolvedValue(document("v2", 2));
  vi.advanceTimersByTime(29_999);
  expect((await getActivePublicData()).manifest.version).toBe("v1");
  vi.advanceTimersByTime(1);
  expect((await getActivePublicData()).manifest.version).toBe("v2");
  expect(db.get).toHaveBeenCalledTimes(2);
});

it("evicts a rejected manifest immediately so recovery does not wait for the TTL", async () => {
  db.get.mockRejectedValueOnce(new Error("offline"));
  const { getActivePublicData } = await import("./public-data-storage");
  await expect(getActivePublicData()).rejects.toThrow("offline");
  expect((await getActivePublicData()).manifest.version).toBe("v1");
  expect(db.get).toHaveBeenCalledTimes(2);
});
