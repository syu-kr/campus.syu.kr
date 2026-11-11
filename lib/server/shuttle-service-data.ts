import { readPublicDataBundle } from "@/lib/server/public-data";
import { getHomePublicHolidays } from "@/lib/server/home-data";
import { unstable_rethrow } from "next/navigation";
import { parsePublicHolidaySnapshot } from "@/lib/public-holidays";
import bundledBuses from "@/public/data/shuttle-bus-schedule.json";
import bundledCalendar from "@/public/data/shuttle-special-periods.json";
import importedBuses from "@/app/campus/bus-info/preview/data/shuttle-bus-schedule.json";
import importedCalendar from "@/app/campus/bus-info/preview/data/shuttle-special-periods.json";
import importedHolidayData from "@/app/campus/bus-info/preview/data/public-holidays.json";
import provenance from "@/app/campus/bus-info/preview/data/provenance.json";
import { applyConfirmedGuideCorrections } from "@/app/campus/bus-info/preview/service-guide-corrections";
import { withPublishedWinter } from "@/app/campus/bus-info/preview/published-vacation";
import type { PublicHolidaySnapshot, ShuttleBusSchedule, ShuttleSpecialPeriods } from "@/types";
import type { ShuttleServiceData } from "@/app/campus/bus-info/preview/service-data";

function importedData(nowISO:string,holidays:PublicHolidaySnapshot=parsePublicHolidaySnapshot(importedHolidayData)):ShuttleServiceData {
  return applyConfirmedGuideCorrections({buses:importedBuses,specialPeriods:withPublishedWinter(importedCalendar as ShuttleSpecialPeriods),holidays,source:"imported-snapshot",version:provenance.scheduleVersion,retrievedAt:provenance.retrievedAt,nowISO});
}

export async function loadShuttleServiceData(operatingPreview=false):Promise<ShuttleServiceData> {
  // Replay within the real holiday snapshot's validity; never refresh its collection time.
  if(operatingPreview) return importedData("2026-10-30T11:50:00+09:00");
  const [result,holidayResult]=await Promise.allSettled([readPublicDataBundle(["shuttle-bus-schedule.json","shuttle-special-periods.json"] as const),getHomePublicHolidays()]);
  for(const item of [result,holidayResult]) if(item.status==="rejected") unstable_rethrow(item.reason);
  const importedHolidays=parsePublicHolidaySnapshot(importedHolidayData);
  const currentHolidays=holidayResult.status==="fulfilled"?holidayResult.value:null;
  const holidays=currentHolidays&&Date.parse(currentHolidays.lastSuccessAt??"")>=Date.parse(importedHolidays.lastSuccessAt??"")?currentHolidays:importedHolidays;
  if(result.status==="fulfilled") {
    const snapshot=result.value;
    return applyConfirmedGuideCorrections({buses:snapshot.data["shuttle-bus-schedule.json"] as ShuttleBusSchedule[],specialPeriods:withPublishedWinter(snapshot.data["shuttle-special-periods.json"] as ShuttleSpecialPeriods),
      holidays,source:snapshot.source,version:snapshot.version,nowISO:new Date().toISOString()});
  } else {
    return {buses:bundledBuses,specialPeriods:withPublishedWinter(bundledCalendar as ShuttleSpecialPeriods),holidays,
      source:"bundled-fallback",version:"bundled",nowISO:new Date().toISOString()};
  }
}
