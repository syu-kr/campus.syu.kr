import buses from "@/public/data/shuttle-bus-schedule.json";
import calendar from "@/public/data/shuttle-special-periods.json";
import holidays from "@/public/data/public-holidays.json";
import { parsePublicHolidaySnapshot } from "@/lib/public-holidays";
import type { ShuttleSpecialPeriods } from "@/types";
import type { ShuttleServiceData } from "./service-data";
import { withPublishedWinter } from "./published-vacation";

// Test-only collection time; runtime never substitutes the real snapshot's freshness.
export const testServiceData:ShuttleServiceData={buses,specialPeriods:withPublishedWinter(calendar as ShuttleSpecialPeriods),
  holidays:parsePublicHolidaySnapshot({...holidays,lastSuccessAt:"2026-10-30T00:00:00Z"}),
  source:"firebase-storage",version:"test",nowISO:"2026-10-31T01:00:00+09:00"};
