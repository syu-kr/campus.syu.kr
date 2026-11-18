// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { readPublicDataBundle } from "@/lib/server/public-data";
import { getHomePublicHolidays } from "@/lib/server/home-data";
import { loadShuttleServiceData } from "./service-data.server";
import { testServiceData } from "./service-test-data";
import { nextScheduledService, serviceRoutes, serviceTimetable } from "./service-data";
import provenance from "./data/provenance.json";
import archivedBuses from "./data/shuttle-bus-schedule.json";
import archivedCalendar from "./data/shuttle-special-periods.json";
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
  expect(result.specialPeriods.specialPeriods.some(period=>period.id.startsWith("essay-exam-"))).toBe(false);
  expect(result.buses.find(bus=>bus.id==="shuttle-2")!.schedules.friday).toContain("08:30");
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
it("keeps current bundled timetables on read failure without manufacturing holiday collection timestamps",async()=>{
  vi.mocked(readPublicDataBundle).mockRejectedValue(new Error("unavailable"));
  vi.mocked(getHomePublicHolidays).mockRejectedValue(new Error("unavailable"));
  const result=await loadShuttleServiceData();
  expect(result).toMatchObject({source:"bundled-fallback",version:"bundled"});
  expect(result.buses).toHaveLength(3);
  expect(result.holidays.lastSuccessAt).toBe("2026-10-29T18:52:36.524687Z");
  expect(result.specialPeriods.specialPeriods.map(period=>period.id)).toEqual(expect.arrayContaining([
    "essay-exam-2026-11-23","essay-exam-2026-11-24","verified-final-fall-2026",
  ]));
  expect(result.buses.find(bus=>bus.id==="shuttle-2")!.schedules.friday).toContain("08:30");
});

it.each(["firebase-storage","bundled-fallback"] as const)("uses current %s data with essay departures and canonical guide corrections",async source=>{
  vi.mocked(readPublicDataBundle<readonly ["shuttle-bus-schedule.json","shuttle-special-periods.json"]>).mockResolvedValue({
    data:{"shuttle-bus-schedule.json":testServiceData.buses,"shuttle-special-periods.json":testServiceData.specialPeriods},
    source,version:source==="firebase-storage"?"snapshot-20261111":"bundled",
  });
  const result=await loadShuttleServiceData();
  expect(result.source).toBe(source);
  expect(result.specialPeriods.specialPeriods).toContainEqual(expect.objectContaining({
    id:"essay-exam-2026-11-23",replacementSchedules:expect.objectContaining({"shuttle-0":[],"shuttle-1":expect.arrayContaining(["14:00","18:15"])}),
  }));
  expect(result.specialPeriods.specialPeriods).toContainEqual(expect.objectContaining({
    id:"essay-exam-2026-11-24",replacementSchedules:expect.objectContaining({"shuttle-0":expect.arrayContaining(["09:00","12:00"]),"shuttle-1":expect.arrayContaining(["12:00","18:15"])}),
  }));
  expect(result.buses.find(bus=>bus.id==="shuttle-2")!.schedules.friday).toContain("08:30");
  expect(result.specialPeriods.specialPeriods).toContainEqual(expect.objectContaining({
    id:"verified-final-fall-2026",applicableDates:["2026-12-08","2026-12-09","2026-12-10","2026-12-14"],addedTimes:["18:40","19:00"],
  }));
  expect(result.specialPeriods.vacationPeriods).toContainEqual(expect.objectContaining({startDate:"2026-12-15",endDate:"2027-01-12"}));
});

it("still corrects the inspected archived revision used by the UI and operational APIs",async()=>{
  vi.mocked(readPublicDataBundle<readonly ["shuttle-bus-schedule.json","shuttle-special-periods.json"]>).mockResolvedValue({
    data:{"shuttle-bus-schedule.json":archivedBuses,"shuttle-special-periods.json":archivedCalendar},
    source:"firebase-storage",version:provenance.scheduleVersion,
  });
  const result=await loadShuttleServiceData();
  expect(result.buses.find(bus=>bus.id==="shuttle-2")!.schedules.friday).toContain("08:30");
  expect(result.specialPeriods.specialPeriods).toContainEqual(expect.objectContaining({
    id:"verified-final-fall-2026",addedTimes:["18:40","19:00"],
  }));
  expect(result.specialPeriods.vacationPeriods).toContainEqual(expect.objectContaining({
    startDate:"2026-12-15",endDate:"2027-01-12",
  }));
});
