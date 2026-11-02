import { applyShuttleSpecialPeriods, getShuttleDayStatus, getShuttleScheduleType, isDateInSpecialPeriod, timeToMinutes } from "../shuttle-schedule";
import { etaServiceDate, type EtaResponse } from "../shuttle-eta";
import { shuttleScheduleIds, type ShuttleRoute } from "../shuttle-visits";
import { loadShuttleServiceData } from "./shuttle-service-data";
import { learningArrivals, scheduledShuttleArrivals, type TimingProfiles, type DeparturePlans } from "../shuttle-learning";
import { getKoreaDateTimeParts } from "../korea-time";
import { shuttleVehicleKey } from "./shuttle-vehicle";
import { pilotRoutes, servicePattern } from "../shuttle-service-window";
import { readShuttleHistory, readShuttleModel, readShuttleState } from "./shuttle-eta-cache";
export { servicePattern } from "../shuttle-service-window";

const routeNames: ShuttleRoute[] = ["hwarangdae", "seokgye", "byeollae"];
let scheduledProfiles: { version: string; live: TimingProfiles; history: TimingProfiles } | undefined;

export async function readShuttleEta(vehicleId?: string): Promise<EtaResponse> {
  const now = new Date(), day = etaServiceDate(+now);
  if ([0, 6].includes(getKoreaDateTimeParts(now).dayOfWeek)) return { status: "learning", arrivals: [] };
  const data = await loadShuttleServiceData();
  if (data.source !== "firebase-storage") return { status: "learning", arrivals: [] };
  const { buses, specialPeriods: periods, holidays } = data;
  const plans: DeparturePlans = {}, patterns: Partial<Record<number, string>> = {};
  for (const [index, route] of routeNames.entries()) {
    const pattern = servicePattern(route, now, buses, periods, holidays);
    if (!pattern) continue;
    const id = shuttleScheduleIds[route], routeId = index + 1;
    if (periods.specialPeriods.some(p => isDateInSpecialPeriod(p, day) && (p.routes.includes("all") || p.routes.includes(id)) && (p.daytimeIntervals || p.additionalServices?.length))) continue;
    patterns[routeId] = pattern;
    const type = getShuttleScheduleType(now, periods);
    const status = getShuttleDayStatus({ dateString: day, specialPeriods: periods, holidays, now });
    const times = status.operationStatus === "exception" ? status.serviceExceptions.filter(e => e.routeId === id).flatMap(e => e.times) :
      type ? applyShuttleSpecialPeriods({ buses: buses.filter(b => b.id === id), dateString: day, specialPeriods: periods }).buses[0]?.schedules[type] ?? [] : [];
    plans[routeId] = times.filter(t => timeToMinutes(t) !== null).map(t => Date.parse(`${day}T${t}:00+09:00`)).sort((a, b) => a - b);
  }
  if (!Object.keys(plans).length) return { status: "learning", arrivals: [] };
  const version = JSON.stringify([day, plans, patterns, holidays.lastSuccessAt]);
  const allowed = pilotRoutes(now, buses, periods, holidays);
  if (!allowed.length) {
    if (vehicleId !== undefined) return { status: "learning", arrivals: [] };
    if (scheduledProfiles?.version !== version) {
      const [history, live] = await Promise.all([readShuttleHistory(version), readShuttleModel()]);
      scheduledProfiles = { version, history, live };
    }
    if (etaServiceDate(Date.now()) !== day) return { status: "learning", arrivals: [] };
    return { status: "learning", arrivals: [], scheduledArrivals: scheduledShuttleArrivals(scheduledProfiles.live, scheduledProfiles.history, plans, patterns, Date.now()) };
  }
  const [live, history] = await Promise.all([readShuttleState(), readShuttleHistory(version)]);
  const profiles = live?.profiles ?? await readShuttleModel();
  const readAt = Date.now(), stillAllowed = pilotRoutes(new Date(readAt), buses, periods, holidays);
  if (etaServiceDate(readAt) !== day) return { status: "learning", arrivals: [] };
  for (const id of Object.keys(plans)) if (patterns[Number(id)] !== servicePattern(routeNames[Number(id) - 1], new Date(readAt), buses, periods, holidays)) delete plans[Number(id)];
  scheduledProfiles = { version, live: profiles, history };
  const compatible = live ? { ...live, runs: live.runs.filter(r => r.pattern === servicePattern(routeNames[r.routeId - 1], new Date(readAt), buses, periods, holidays)) } : undefined;
  const livePlans = Object.fromEntries(Object.entries(plans).filter(([id]) => stillAllowed.includes(Number(id))));
  return {
    status: "learning",
    arrivals: learningArrivals(compatible, history, livePlans, readAt, vehicleId === undefined ? undefined : shuttleVehicleKey(vehicleId, readAt)),
    ...(vehicleId === undefined ? { scheduledArrivals: scheduledShuttleArrivals(profiles, history, plans, patterns, readAt) } : {}),
  };
}
