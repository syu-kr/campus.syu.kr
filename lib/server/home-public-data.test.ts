// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ActivePublicData } from "./public-data-storage";

const mocks = vi.hoisted(() => ({ enabled: vi.fn(), active: vi.fn(), announcements: vi.fn(), schedules: vi.fn(), holidays: vi.fn(), cafeteria: vi.fn(), shuttles: vi.fn(), special: vi.fn(), cache: new Map<string, string>() }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>, keys: string[]) => async (...args: unknown[]) => {
  const key = JSON.stringify([keys, args]);
  if (mocks.cache.has(key)) return JSON.parse(mocks.cache.get(key)!);
  const result = await fn(...args); mocks.cache.set(key, JSON.stringify(result)); return result;
} }));
vi.mock("./public-data-storage", () => ({ publicDataFirebaseEnabled: mocks.enabled, publicDataBucketName: () => "test-bucket", firebasePublicDataStore: () => ({ readActive: mocks.active }) }));
vi.mock("./announcements", () => ({ getAnnouncementSummary: mocks.announcements }));
vi.mock("./home-data", () => ({ getHomeAcademicSchedules: mocks.schedules, getHomePublicHolidays: mocks.holidays, getHomeCafeteriaSnapshot: mocks.cafeteria, getHomeShuttleBuses: mocks.shuttles, getHomeShuttleSpecialPeriods: mocks.special }));
const active = { revision: 1, manifest: { version: "v1", sourceHealth: {} } } as ActivePublicData;
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(15_000); mocks.cache.clear();
  mocks.enabled.mockReset().mockReturnValue(true); mocks.active.mockReset().mockResolvedValue(active);
  mocks.announcements.mockReset().mockImplementation(async (_limit, snapshot) => [{ id: snapshot?.manifest.version ?? "fallback" }]);
  mocks.schedules.mockReset().mockResolvedValue([]); mocks.holidays.mockReset().mockResolvedValue({ holidays: [], stale: false });
  mocks.cafeteria.mockReset().mockResolvedValue({ menus: [], checkedAt: null, stale: false });
  mocks.shuttles.mockReset().mockResolvedValue([]); mocks.special.mockReset().mockResolvedValue({ specialPeriods: [], semesterPeriods: [], vacationPeriods: [] });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it("shares the manifest and complete home snapshot across process/module instances", async () => {
  let reader = await import("./home-public-data");
  const first = await reader.getHomePublicData();
  vi.resetModules(); reader = await import("./home-public-data");
  expect(await reader.getHomePublicData()).toEqual(first);
  expect(mocks.active).toHaveBeenCalledTimes(1);
  expect(mocks.announcements).toHaveBeenCalledExactlyOnceWith(12, active);
  for (const fn of [mocks.schedules, mocks.holidays, mocks.cafeteria, mocks.shuttles, mocks.special]) expect(fn).toHaveBeenCalledExactlyOnceWith(active);
});

it("uses a new manifest key at thirty seconds without stacking another process TTL", async () => {
  const reader = await import("./home-public-data");
  expect((await reader.getHomePublicData()).initialAnnouncements[0].id).toBe("v1");
  const next = { ...active, revision: 2, manifest: { ...active.manifest, version: "v2" } };
  mocks.active.mockResolvedValue(next); vi.setSystemTime(29_999);
  vi.resetModules();
  expect((await (await import("./home-public-data")).getHomePublicData()).initialAnnouncements[0].id).toBe("v1");
  vi.setSystemTime(30_000);
  expect((await reader.getHomePublicData()).initialAnnouncements[0].id).toBe("v2");
  expect(mocks.active).toHaveBeenCalledTimes(2);
});

it("changes cached content on deletion, source health updates and rollback revisions", async () => {
  const reader = await import("./home-public-data"); await reader.getHomePublicData();
  vi.setSystemTime(30_000); mocks.active.mockResolvedValue({ revision: 2, manifest: { ...active.manifest, version: "v2" } });
  mocks.announcements.mockResolvedValue([]); mocks.holidays.mockResolvedValue({ holidays: [], stale: true });
  expect(await reader.getHomePublicData()).toMatchObject({ initialAnnouncements: [], initialPublicHolidays: { stale: true } });
  vi.setSystemTime(60_000); mocks.active.mockResolvedValue({ ...active, revision: 3 });
  mocks.announcements.mockResolvedValue([{ id: "v1" }]);
  expect((await reader.getHomePublicData()).initialAnnouncements[0].id).toBe("v1");
});

it("does not persist fallback data after either a manifest or snapshot failure", async () => {
  const reader = await import("./home-public-data");
  mocks.active.mockRejectedValueOnce(new Error("offline"));
  expect((await reader.getHomePublicData()).initialAnnouncements[0].id).toBe("fallback");
  expect(mocks.cache.size).toBe(0);
  mocks.cafeteria.mockImplementation(async snapshot => { if (snapshot) throw new Error("menu unavailable"); return { menus: [], stale: true }; });
  expect(await reader.getHomePublicData()).toMatchObject({ initialOverviewData: { cafeteria: { stale: true } } });
  expect(mocks.cache.size).toBe(1);
  mocks.cafeteria.mockResolvedValue({ menus: [], stale: false });
  expect((await reader.getHomePublicData()).initialAnnouncements[0].id).toBe("v1");
  expect(mocks.cache.size).toBe(2);
});

it("preserves the Pages path and optional cafeteria failure without shared cache writes", async () => {
  mocks.enabled.mockReturnValue(false); mocks.cafeteria.mockRejectedValue(new Error("unavailable"));
  const result = await (await import("./home-public-data")).getHomePublicData();
  expect(result.initialOverviewData.cafeteria).toBeUndefined();
  expect(mocks.active).not.toHaveBeenCalled(); expect(mocks.cache.size).toBe(0);
});

it("reports actual cache callback execution as miss or hit in request-scoped telemetry", async () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  let reader = await import("./home-public-data"); let trace = await import("./home-performance");
  await trace.traceHomeData("home", reader.getHomePublicData);
  const first = JSON.parse(log.mock.calls[0][1]);
  expect(first.steps).toContainEqual(expect.objectContaining({ step: "manifest-cache", cache: "miss" }));
  expect(first.steps).toContainEqual(expect.objectContaining({ step: "home-snapshot-cache", cache: "miss" }));
  vi.resetModules(); reader = await import("./home-public-data"); trace = await import("./home-performance");
  await trace.traceHomeData("home", reader.getHomePublicData);
  const second = JSON.parse(log.mock.calls[1][1]);
  expect(second.steps).toContainEqual(expect.objectContaining({ step: "manifest-cache", cache: "hit" }));
  expect(second.steps).toContainEqual(expect.objectContaining({ step: "home-snapshot-cache", cache: "hit" }));
  expect(second.steps.some((step: { step: string }) => step.step === "home-snapshot-build" || step.step.startsWith("manifest-source"))).toBe(false);
});
