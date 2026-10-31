import { afterEach, beforeEach, expect, it, vi } from "vitest";
import buses from "@/public/data/shuttle-bus-schedule.json";
import calendar from "@/public/data/shuttle-special-periods.json";
import type { PublicHolidaySnapshot, ShuttleSpecialPeriods } from "@/types";
import type { EtaRelease } from "@/lib/shuttle-eta";
import { servicePattern } from "@/lib/server/shuttle-eta";
import { GET } from "./route";

const { releases, get, readBuses, readHolidays, readPeriods } = vi.hoisted(() => ({
  releases: [] as EtaRelease[], get: vi.fn(), readBuses: vi.fn(), readHolidays: vi.fn(), readPeriods: vi.fn(),
}));
vi.mock("@/lib/server/shuttle-eta-releases", () => ({ shuttleEtaReleases: releases }));
vi.mock("@/lib/server/home-data", () => ({
  getHomePublicHolidays: readHolidays, getHomeShuttleBuses: readBuses, getHomeShuttleSpecialPeriods: readPeriods,
}));
vi.mock("@/lib/server/firestore", () => ({ getFirestore: () => ({ collection: () => ({ doc: () => ({ get }) }) }) }));

const now = Date.parse("2026-11-03T15:00:00+09:00"), periods = calendar as ShuttleSpecialPeriods;
const holidays: PublicHolidaySnapshot = { schemaVersion: 1, sourceUrl: "", years: [2026], lastSuccessAt: new Date(now - 1_000).toISOString(), holidays: [] };
const model: EtaRelease = {
  route: "seokgye", phase: "moving", shape: "test", pattern: "mondayToThursday", validFrom: "2026-11-01", validThrough: "2026-11-30",
  target: "seokgye-taereung-7", legs: [{ from: "seokgye-4", medianSeconds: 300, dwellSeconds: null, fixedDeparture: false }],
  entryWindow: { weekdays: [2], startMinute: 14 * 60, endMinute: 16 * 60 },
  horizonMinutes: 10, evidence: "synthetic-test", validation: { independentRuns: 10, coverage: 1, incorrectService: 0, near: { n: 10, maeSeconds: 20, p90Seconds: 42 } },
};
const run = { runId: "private-run", vehicleKey: "private-vehicle", passenger: true, match: "verified", phase: "moving", route: "seokgye",
  serviceDate: "2026-11-03", from: "seokgye-4", fraction: .2, measuredAt: now, receivedAt: now, enteredAt: now - 60_000, shape: "test", pattern: model.pattern };
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now);
  readBuses.mockResolvedValue(buses); readHolidays.mockResolvedValue(holidays); readPeriods.mockResolvedValue(periods);
  get.mockResolvedValue({ data: () => ({ runs: [run] }) });
});
afterEach(() => { vi.useRealTimers(); releases.length = 0; vi.clearAllMocks(); });

it("does not open the operational feed without a passing field release", async () => {
  releases.push({ ...model, validation: { ...model.validation, coverage: .89 } });
  const res = await GET();
  expect(await res.json()).toEqual({ status: "collecting", arrivals: [] });
  expect(get).not.toHaveBeenCalled(); expect(readBuses).not.toHaveBeenCalled();
});
it("runs the opt-in synthetic calculation check without a receiver or database read",async()=>{
  const res=await GET(new Request("https://example.invalid/preview/eta?check=1"));
  expect(await res.json()).toEqual({source:"synthetic",passed:true});
  expect(get).not.toHaveBeenCalled();expect(readBuses).not.toHaveBeenCalled();
});
it("returns only the approved visit, prediction and source validity, with a short CDN lifetime", async () => {
  releases.push(model);
  const res = await GET();
  expect(res.headers.get("cache-control")).toContain("s-maxage=5");
  expect(await res.json()).toEqual({ status: "active", arrivals: [{
    visitId: model.target, arrivalAt: now + 240_000, measuredAt: now, validUntil: now + 90_000,
  }] });
  vi.setSystemTime(now + 90_000);
  expect((await (await GET()).json()).arrivals).toEqual([]);
});
it("does not serve cached numbers on a feed error, closure or stale holiday calendar", async () => {
  releases.push(model);
  get.mockRejectedValueOnce(new Error("private detail"));
  const error = await GET(); expect(error.status).toBe(503); expect(error.headers.get("cache-control")).toBe("no-store");
  expect(await error.json()).toEqual({ status: "unavailable", arrivals: [] });
  get.mockClear(); readHolidays.mockResolvedValue({ ...holidays, stale: true });
  expect((await (await GET()).json()).arrivals).toEqual([]); expect(get).not.toHaveBeenCalled();
  vi.setSystemTime(Date.parse("2026-11-07T15:00:00+09:00"));
  expect((await (await GET()).json()).arrivals).toEqual([]); expect(get).not.toHaveBeenCalled();
});
it("does not reuse a normal semester model on Friday, online week or a route-unspecified festival", () => {
  function pattern(day: string) {
    const date = new Date(day + "T15:00:00+09:00");
    return servicePattern("seokgye", date, buses, periods, { ...holidays, lastSuccessAt: date.toISOString() });
  }
  expect(pattern("2026-11-06")).toBe("friday");
  expect(pattern("2026-11-02")).toContain("online-class-week-fall-2026");
  expect(pattern("2026-10-06")).toBeUndefined();
});
