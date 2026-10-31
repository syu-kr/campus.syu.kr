// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { readPublicDataBundle } from "@/lib/server/public-data";
import { getHomePublicHolidays } from "@/lib/server/home-data";
import { loadShuttleServiceData } from "./service-data.server";
import { testServiceData } from "./service-test-data";
import { nextScheduledService, serviceRoutes, serviceTimetable } from "./service-data";
vi.mock("@/lib/server/public-data",()=>({readPublicDataBundle:vi.fn()}));
vi.mock("@/lib/server/home-data",()=>({getHomePublicHolidays:vi.fn()}));
vi.mock("next/navigation",()=>({unstable_rethrow:vi.fn()}));
beforeEach(()=>{
  vi.clearAllMocks();
  vi.mocked(getHomePublicHolidays).mockResolvedValue(testServiceData.holidays);
  vi.mocked(readPublicDataBundle<readonly ["shuttle-bus-schedule.json","shuttle-special-periods.json"]>).mockResolvedValue({data:{"shuttle-bus-schedule.json":testServiceData.buses,"shuttle-special-periods.json":testServiceData.specialPeriods},source:"firebase-storage",version:"same-version"});
});
it("replays the archived operating window without reads or altered source timestamps",async()=>{
  const result=await loadShuttleServiceData(true);
  expect(result.specialPeriods.vacationPeriods).toContainEqual(expect.objectContaining({startDate:"2026-12-15",endDate:"2027-01-12"}));
  expect(result.nowISO).toBe("2026-10-30T11:50:00+09:00");
  expect(result.holidays.lastSuccessAt).toBe("2026-10-29T18:52:36.524687Z");
  expect(readPublicDataBundle).not.toHaveBeenCalled();expect(getHomePublicHolidays).not.toHaveBeenCalled();
  const now=new Date(result.nowISO);
  expect(serviceRoutes.map(route=>serviceTimetable({route,date:"2026-10-30",now,data:result}).status)).toEqual(["ready","ready","ready"]);
  expect(serviceRoutes.map(route=>nextScheduledService({route,now,data:result})?.time)).toEqual(["12:00","12:00","12:30"]);
});
it("pins both timetable files to one bundle and preserves holiday source health",async()=>{
  vi.mocked(getHomePublicHolidays).mockResolvedValue({...testServiceData.holidays,stale:true});
  const result=await loadShuttleServiceData();
  expect(readPublicDataBundle).toHaveBeenCalledWith(["shuttle-bus-schedule.json","shuttle-special-periods.json"]);
  expect(result).toMatchObject({source:"firebase-storage",version:"same-version",buses:testServiceData.buses,holidays:{stale:true}});
  expect(Number.isFinite(Date.parse(result.nowISO))).toBe(true);
});
it("falls back to the actual imported snapshot without manufacturing collection timestamps",async()=>{
  vi.mocked(readPublicDataBundle).mockRejectedValue(new Error("unavailable"));
  vi.mocked(getHomePublicHolidays).mockRejectedValue(new Error("unavailable"));
  const result=await loadShuttleServiceData();
  expect(result.source).toBe("imported-snapshot");
  expect(result.buses).toHaveLength(3);
  expect(result.holidays.lastSuccessAt).toBe("2026-10-29T18:52:36.524687Z");
  expect(result.guideCorrections).toBe(true);
});
