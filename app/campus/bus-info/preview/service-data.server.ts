import { readPublicDataBundle } from "@/lib/server/public-data";
import { getHomePublicHolidays } from "@/lib/server/home-data";
import { unstable_rethrow } from "next/navigation";
import { parsePublicHolidaySnapshot } from "@/lib/public-holidays";
import importedBuses from "./data/shuttle-bus-schedule.json";
import importedCalendar from "./data/shuttle-special-periods.json";
import importedHolidayData from "./data/public-holidays.json";
import provenance from "./data/provenance.json";
import { applyConfirmedGuideCorrections } from "./service-guide-corrections";
import { withPublishedWinter } from "./published-vacation";
import type { PublicHolidaySnapshot, ShuttleBusSchedule, ShuttleSpecialPeriods } from "@/types";
import type { ShuttleServiceData } from "./service-data";

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
  if(result.status==="fulfilled"&&result.value.source==="firebase-storage") {
    const snapshot=result.value;
    return applyConfirmedGuideCorrections({buses:snapshot.data["shuttle-bus-schedule.json"] as ShuttleBusSchedule[],specialPeriods:withPublishedWinter(snapshot.data["shuttle-special-periods.json"] as ShuttleSpecialPeriods),
      holidays,source:snapshot.source,version:snapshot.version,nowISO:new Date().toISOString()});
  } else {
    return importedData(new Date().toISOString(),holidays);
  }
}
