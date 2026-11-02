import type { PublicHolidaySnapshot, ShuttleBusSchedule, ShuttleSpecialPeriods } from "@/types";
import { applyShuttleSpecialPeriods, getShuttleDayStatus, getShuttleScheduleType, isDateInSpecialPeriod, timeToMinutes } from "../shuttle-schedule";
import { etaServiceDate, type EtaResponse } from "../shuttle-eta";
import { shuttleScheduleIds, type ShuttleRoute } from "../shuttle-visits";
import { getFirestore } from "./firestore";
import { getHomePublicHolidays, getHomeShuttleBuses, getHomeShuttleSpecialPeriods } from "./home-data";
import { learningArrivals, type LearningState, type TimingProfiles, type DeparturePlans } from "../shuttle-learning";
import { getKoreaDateTimeParts } from "../korea-time";
import { shuttleVehicleKey } from "./shuttle-vehicle";

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

// Opt out of unconfirmed notices, but keep observations across headways and the final trip.
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
    // shortcut: last-trip collection ends 30 minutes after departure; extend after observing longer trips.
    if (minutes.length && clock >= Math.min(...minutes) - 15 && clock <= Math.max(...minutes) + 30) eligible.push(index + 1);
  }
  return eligible;
}

export async function readShuttleEta(vehicleId?: string): Promise<EtaResponse> {
  const now=new Date(),day=etaServiceDate(+now);
  if([0,6].includes(getKoreaDateTimeParts(now).dayOfWeek))return {status:"learning",arrivals:[]};
  const [buses, periods, holidays] = await Promise.all([getHomeShuttleBuses(), getHomeShuttleSpecialPeriods(), getHomePublicHolidays()]);
  const allowed=pilotRoutes(now,buses,periods,holidays),plans:DeparturePlans={};
  if(!allowed.length)return {status:"learning",arrivals:[]};
  for(const routeId of allowed) {
    const id=shuttleScheduleIds[(["hwarangdae","seokgye","byeollae"] as const)[routeId-1]],type=getShuttleScheduleType(now,periods);
    const dayStatus=getShuttleDayStatus({dateString:day,specialPeriods:periods,holidays,now});
    const times=dayStatus.operationStatus==="exception"?dayStatus.serviceExceptions.filter(e=>e.routeId===id).flatMap(e=>e.times):
      type?applyShuttleSpecialPeriods({buses:buses.filter(b=>b.id===id),dateString:day,specialPeriods:periods}).buses[0]?.schedules[type]??[]:[];
    plans[routeId]=times.filter(t=>timeToMinutes(t)!==null).map(t=>Date.parse(`${day}T${t}:00+09:00`)).sort((a,b)=>a-b);
  }
  const db=getFirestore();
  const [state,history]=await Promise.all([db.collection("shuttle_eta").doc("current").get(),db.collection("shuttle_eta").doc("history").get()]);
  const readAt = Date.now();
  const stillAllowed=pilotRoutes(new Date(readAt),buses,periods,holidays);
  if(etaServiceDate(readAt)!==day||!stillAllowed.length)return {status:"learning",arrivals:[]};
  for(const id of Object.keys(plans))if(!stillAllowed.includes(Number(id)))delete plans[Number(id)];
  const current=state.data();
  const live=current?.schemaVersion===3&&Array.isArray(current.runs)?current as LearningState:undefined;
  const compatible=live?{...live,runs:live.runs.filter(r=>r.pattern===servicePattern((["hwarangdae","seokgye","byeollae"] as const)[r.routeId-1],new Date(readAt),buses,periods,holidays))}:undefined;
  return {status:"learning",arrivals:learningArrivals(compatible,
    (history.data()?.profiles??{}) as TimingProfiles,plans,readAt,vehicleId===undefined?undefined:shuttleVehicleKey(vehicleId,readAt))};
}
