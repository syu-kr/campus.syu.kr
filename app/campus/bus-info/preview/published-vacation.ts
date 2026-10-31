import type { ShuttleSpecialPeriods } from "@/types";

// Published by SYU at /school-life/school-bus/, checked 2026-10-31.
export const winterVacation = {
  id: "winter-2026",
  name: "동계방학",
  startDate: "2026-12-15",
  endDate: "2027-01-12",
  scheduleType: "vacation" as const,
};

export function withPublishedWinter(calendar: ShuttleSpecialPeriods): ShuttleSpecialPeriods {
  const periods=calendar.vacationPeriods??[];
  if(periods.some(p=>p.startDate<=winterVacation.endDate && p.endDate>=winterVacation.startDate))return calendar;
  return {...calendar,vacationPeriods:[...periods,winterVacation]};
}

export const winterDepartures = {
  weekdays: {
    campus: ["08:10","08:20","09:10","10:10","11:10","12:10","13:10","14:10","15:10","16:10","17:10"],
    station: ["08:30","08:40","09:30","10:30","11:30","12:30","13:30","14:30","15:30","16:30"],
  },
  friday: {
    campus: ["08:10","08:20","09:10","10:10","11:10","12:10","13:10","14:10"],
    station: ["08:30","08:40","09:30","10:30","11:30","12:30","13:30","14:30"],
  },
};
