// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import type { ActivePublicData } from "./public-data-storage";
import { emptyPublicHolidays } from "../public-holidays";
const readers = vi.hoisted(() => ({ firebase: vi.fn(), daily: vi.fn() }));
vi.mock("./public-data-storage", () => ({ readFirebasePublicData: readers.firebase }));
vi.mock("./crawl-data", () => ({ readDailyCrawlDataSnapshot: readers.daily }));
import { getHomeAcademicSchedules, getHomePublicHolidays, getHomeCafeteriaSnapshot, getHomeShuttleBuses, getHomeShuttleSpecialPeriods } from "./home-data";
const active = { revision: 2, manifest: { version: "v2", sourceHealth: {
  "public-holidays.json": { status: "stale", lastAttemptAt: "2026-10-30T00:00:00Z", lastSuccessAt: "2026-10-29T00:00:00Z" },
  "cafeteria-menu.json": { status: "stale", lastAttemptAt: "2026-10-30T00:00:00Z", lastSuccessAt: "2026-10-29T00:00:00Z" },
} } } as ActivePublicData;
beforeEach(() => { readers.firebase.mockReset(); readers.daily.mockReset(); });

it("uses the pinned version and source confirmation for holidays and cafeteria", async () => {
  readers.firebase.mockImplementation(async (file: string) => ({ manifest: active.manifest, data: file === "public-holidays.json" ? emptyPublicHolidays() : { menus: [] } }));
  expect(await getHomePublicHolidays(active)).toMatchObject({ stale: true });
  expect(await getHomeCafeteriaSnapshot(active)).toEqual({ menus: [], stale: true, checkedAt: "2026-10-29T00:00:00Z" });
  expect(readers.firebase.mock.calls.every(([, pinned]) => pinned === active)).toBe(true);
  expect(readers.daily).not.toHaveBeenCalled();
});

it("lets every pinned source error escape so a degraded home result cannot be shared", async () => {
  const error = new Error("invalid snapshot"); readers.firebase.mockRejectedValue(error);
  for (const read of [getHomeAcademicSchedules, getHomePublicHolidays, getHomeCafeteriaSnapshot, getHomeShuttleBuses, getHomeShuttleSpecialPeriods]) await expect(read(active)).rejects.toBe(error);
});

it("rejects malformed pinned holidays instead of caching an empty successful result", async () => {
  readers.firebase.mockResolvedValue({ data: {}, manifest: active.manifest });
  await expect(getHomePublicHolidays(active)).rejects.toThrow();
});
