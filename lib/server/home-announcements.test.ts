// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ActivePublicData } from "./public-data-storage";

const mocks = vi.hoisted(() => ({ enabled: vi.fn(), active: vi.fn(), summary: vi.fn(), cache: new Map<string, string>() }));
vi.mock("./public-data-storage", () => ({ publicDataFirebaseEnabled: mocks.enabled, getActivePublicData: mocks.active }));
vi.mock("./announcements", () => ({ getAnnouncementSummary: mocks.summary }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>) => async (...args: unknown[]) => {
  const key = JSON.stringify(args);
  if (mocks.cache.has(key)) return JSON.parse(mocks.cache.get(key)!);
  const result = await fn(...args);
  mocks.cache.set(key, JSON.stringify(result));
  return result;
} }));

const active = { revision: 1, manifest: { version: "v1", files: { "announcements-academic.json": { sha256: "hash-v1" } } } } as unknown as ActivePublicData;
beforeEach(() => {
  vi.resetModules(); mocks.cache.clear();
  mocks.enabled.mockReset().mockReturnValue(true);
  mocks.active.mockReset().mockResolvedValue(active);
  mocks.summary.mockReset().mockResolvedValue([{ id: "v1" }]);
});
afterEach(() => vi.restoreAllMocks());

it("reuses a small shared summary across module instances while checking the active snapshot on each request", async () => {
  let cacheReader = await import("./home-announcements");
  expect(await cacheReader.getHomeAnnouncementSummary()).toEqual([{ id: "v1" }]);
  vi.resetModules(); cacheReader = await import("./home-announcements");
  expect(await cacheReader.getHomeAnnouncementSummary()).toEqual([{ id: "v1" }]);
  expect(mocks.active).toHaveBeenCalledTimes(2);
  expect(mocks.summary).toHaveBeenCalledExactlyOnceWith(12, active);
});

it("reads a new version immediately, including removed notices and changed metadata, and supports rollback", async () => {
  const cacheReader = await import("./home-announcements");
  await cacheReader.getHomeAnnouncementSummary();
  const next = { ...active, revision: 2, manifest: { ...active.manifest, version: "v2" } };
  mocks.active.mockResolvedValue(next); mocks.summary.mockResolvedValue([]);
  expect(await cacheReader.getHomeAnnouncementSummary()).toEqual([]);
  mocks.active.mockResolvedValue({ ...active, revision: 3 });
  mocks.summary.mockResolvedValue([{ id: "v1" }]);
  expect(await cacheReader.getHomeAnnouncementSummary()).toEqual([{ id: "v1" }]);
  expect(mocks.summary).toHaveBeenCalledTimes(3);
});

it("never persists a degraded result and retries the same immutable version after recovery", async () => {
  const cacheReader = await import("./home-announcements");
  mocks.summary.mockRejectedValueOnce(new Error("unavailable")).mockResolvedValueOnce([{ id: "fallback" }]).mockResolvedValue([{ id: "recovered" }]);
  expect(await cacheReader.getHomeAnnouncementSummary()).toEqual([{ id: "fallback" }]);
  expect(mocks.summary).toHaveBeenNthCalledWith(2, 12);
  expect(await cacheReader.getHomeAnnouncementSummary()).toEqual([{ id: "recovered" }]);
  expect(await cacheReader.getHomeAnnouncementSummary()).toEqual([{ id: "recovered" }]);
  expect(mocks.summary).toHaveBeenCalledTimes(3);
});

it("uses the original behavior without Firebase or when the active manifest fails", async () => {
  const cacheReader = await import("./home-announcements");
  mocks.enabled.mockReturnValue(false); await cacheReader.getHomeAnnouncementSummary();
  expect(mocks.active).not.toHaveBeenCalled();
  expect(mocks.summary).toHaveBeenCalledExactlyOnceWith(12);
  mocks.enabled.mockReturnValue(true); mocks.active.mockRejectedValue(new Error("offline"));
  await cacheReader.getHomeAnnouncementSummary();
  expect(mocks.cache.size).toBe(0);
});
