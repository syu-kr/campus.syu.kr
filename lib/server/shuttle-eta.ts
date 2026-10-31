import type { PublicHolidaySnapshot, ShuttleBusSchedule, ShuttleSpecialPeriods } from "@/types";
import { applyShuttleSpecialPeriods, getShuttleDayStatus, getShuttleScheduleType, isDateInSpecialPeriod, timeToMinutes } from "../shuttle-schedule";
import { calculateCandidateArrivals, etaServiceDate, passedFieldGate, type EtaResponse } from "../shuttle-eta";
import { shuttleScheduleIds, type ShuttleRoute } from "../shuttle-visits";
import { getFirestore } from "./firestore";
import { getHomePublicHolidays, getHomeShuttleBuses, getHomeShuttleSpecialPeriods } from "./home-data";
import { shuttleEtaReleases } from "./shuttle-eta-releases";
import { getKoreaDateTimeParts } from "../korea-time";

export function servicePattern(route: ShuttleRoute, now: Date, buses: ShuttleBusSchedule[], periods: ShuttleSpecialPeriods, holidays: PublicHolidaySnapshot) {
  const dateString = etaServiceDate(now.getTime()), id = shuttleScheduleIds[route];
  const bus = buses.find(b => b.id === id);
  if (!bus) return undefined;
  const day = getShuttleDayStatus({ dateString, specialPeriods: periods, holidays, now });
  const { dayOfWeek } = getKoreaDateTimeParts(now);
  if (dayOfWeek === 0 || dayOfWeek === 6 || day.holiday.status !== "not-holiday" ||
    periods.closedDates?.some(d => d.date === dateString)) return undefined;
  if (day.operationStatus === "exception") {
    return day.serviceExceptions.some(e => e.routeId === id) ? `exception:${dateString}` : undefined;
  }
  if (day.operationStatus !== "regular") return undefined;
  const type = getShuttleScheduleType(now, periods);
  if (!type) return undefined;
  const onDate = periods.specialPeriods.filter(p => isDateInSpecialPeriod(p, dateString));
  // A school-wide interval notice may have no route IDs. Its regular timetable is unsafe.
  if (onDate.some(p => !p.routes.length)) return undefined;
  const active = onDate.filter(p => p.routes.includes(id) || p.routes.includes("all"));
  const schedule = applyShuttleSpecialPeriods({ buses: [bus], dateString, specialPeriods: periods }).buses[0];
  if (!schedule.schedules[type].some(t => timeToMinutes(t) !== null) && !active.some(p => p.daytimeIntervals)) return undefined;
  return [type, ...active.map(p => p.id).sort()].join(":");
}

// Conservative pilot: opt out of headway-only notices, timetable gaps and the period after the last departure.
export function pilotRoutes(now: Date, buses: ShuttleBusSchedule[], periods: ShuttleSpecialPeriods, holidays: PublicHolidaySnapshot) {
  const {hour, minute} = getKoreaDateTimeParts(now), clock = hour * 60 + minute, day = etaServiceDate(now.getTime());
  const eligible: number[] = [];
  for (const [index, route] of (["hwarangdae", "seokgye", "byeollae"] as const).entries()) {
    const pattern = servicePattern(route, now, buses, periods, holidays);
    if (!pattern) continue;
    const id = shuttleScheduleIds[route];
    const periodsToday = periods.specialPeriods.filter(p => isDateInSpecialPeriod(p, day) && (p.routes.includes(id) || p.routes.includes("all")));
    if (periodsToday.some(p => p.daytimeIntervals || p.additionalServices?.length)) continue;
    const type = getShuttleScheduleType(now, periods);
    const times = pattern.startsWith("exception:") ? getShuttleDayStatus({dateString:day,specialPeriods:periods,holidays,now}).serviceExceptions.filter(e=>e.routeId===id).flatMap(e=>e.times)
      : type ? applyShuttleSpecialPeriods({buses: buses.filter(b=>b.id===id), dateString: day, specialPeriods:periods}).buses[0]?.schedules[type] ?? [] : [];
    const minutes = times.map(timeToMinutes).filter((n): n is number => n !== null);
    if (minutes.some(t => t <= clock && clock - t < 20) && clock <= Math.max(...minutes)) eligible.push(index + 1);
  }
  return eligible;
}

export async function readShuttleEta(): Promise<EtaResponse> {
  const day = etaServiceDate(Date.now());
  const models = shuttleEtaReleases.filter(m => m.validFrom <= day && day <= m.validThrough && passedFieldGate(m));
  if (!models.length) return { status: "collecting", arrivals: [] };
  const [buses, periods, holidays] = await Promise.all([getHomeShuttleBuses(), getHomeShuttleSpecialPeriods(), getHomePublicHolidays()]);
  const patterns: Partial<Record<ShuttleRoute, string>> = {};
  const now = new Date();
  for (const route of new Set(models.map(m => m.route))) patterns[route] = servicePattern(route, now, buses, periods, holidays);
  if (!models.some(m => patterns[m.route] === m.pattern)) return { status: "active", arrivals: [] };
  const state = await getFirestore().collection("shuttle_eta").doc("current").get();
  const readAt = Date.now();
  if (etaServiceDate(readAt) !== day) return { status: "active", arrivals: [] };
  return { status: "active", arrivals: calculateCandidateArrivals(state.data()?.runs, models, patterns, readAt) };
}
