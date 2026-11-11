import { applyShuttleSpecialPeriods, getShuttleDayStatus, getShuttleScheduleType, isDateInSpecialPeriod, timeToMinutes } from "../shuttle-schedule";
import { etaServiceDate, type EtaResponse } from "../shuttle-eta";
import { shuttleScheduleIds, type ShuttleRoute } from "../shuttle-visits";
import { loadShuttleServiceData } from "./shuttle-service-data";
import { learningArrivals, scheduledShuttleTrips, nextScheduledShuttleArrivals, type TimingProfiles, type DeparturePlans } from "../shuttle-learning";
import { getKoreaDateTimeParts } from "../korea-time";
import { shuttleVehicleKey } from "./shuttle-vehicle";
import { pilotRoutes, servicePattern, shuttleCollectionLeadMinutes } from "../shuttle-service-window";
import { readShuttleHistory, readShuttleModel, readShuttleState } from "./shuttle-eta-cache";
export { servicePattern } from "../shuttle-service-window";

const routeNames: ShuttleRoute[] = ["hwarangdae", "seokgye", "byeollae"];
let scheduledProfiles: { version: string; live: TimingProfiles; history: TimingProfiles; validUntil: number } | undefined;

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
  const version = JSON.stringify([data.version, day, plans, patterns, holidays.lastSuccessAt]);
  const allowed = pilotRoutes(now, buses, periods, holidays);
  const dayEnd=Date.parse(`${day}T00:00:00+09:00`)+86400_000;
  const holidayExpiry=Date.parse(holidays.lastSuccessAt??"")+3*86400_000;
  const openings=Object.entries(plans).flatMap(([id,times])=>(times??[]).map(at=>at-shuttleCollectionLeadMinutes(patterns[Number(id)]!)*60000)).filter(at=>at>+now);
  // shortcut: keep scheduled forecasts through a five-minute outage; tune only against observed disruption errors.
  const validUntil=Math.min(dayEnd,holidayExpiry,allowed.length?+now+5*60000:Math.min(...openings,dayEnd));
  const context={serviceDate:day,version:data.version,generatedAt:+now,validUntil:Number.isFinite(validUntil)?validUntil:+now};
  if (!Object.keys(plans).length) return { status: "learning", arrivals: [], scheduledArrivals: [], trips: [], context };
  const prior=scheduledProfiles?.version===version&&scheduledProfiles.validUntil>Date.now()?scheduledProfiles:undefined;
  const scheduled=(live:TimingProfiles,history:TimingProfiles,at:number,until:number)=>{
    const trips=scheduledShuttleTrips(live,history,plans,patterns,at,until);
    return {trips,scheduledArrivals:nextScheduledShuttleArrivals(trips,at)};
  };
  if (!allowed.length) {
    if (vehicleId !== undefined) return { status: "learning", arrivals: [], context };
    if (!prior) {
      const [history, live] = await Promise.all([readShuttleHistory(version), readShuttleModel()]);
      scheduledProfiles = { version, history, live, validUntil };
    }
    if (etaServiceDate(Date.now()) !== day) return { status: "learning", arrivals: [] };
    const profiles=prior??scheduledProfiles!;
    return { status: "learning", arrivals: [], ...scheduled(profiles.live,profiles.history,Date.now(),context.validUntil), context };
  }
  const [stateResult,historyResult] = await Promise.allSettled([readShuttleState(), readShuttleHistory(version)]);
  const live=stateResult.status==="fulfilled"?stateResult.value:undefined;
  // A failed read is not evidence of an empty model. Only reuse an unexpired, same-plan snapshot.
  const history=historyResult.status==="fulfilled"?historyResult.value:prior?.history;
  if(!history) throw new Error("Shuttle history unavailable");
  let profiles=live?.profiles;
  let modelFailed=false;
  if(!profiles) {
    try {profiles=await readShuttleModel();}
    catch {modelFailed=true;profiles=prior?.live;}
  }
  if(!profiles) throw new Error("Shuttle model unavailable");
  const reused=historyResult.status==="rejected"||modelFailed;
  const degraded=reused||stateResult.status==="rejected";
  const readAt = Date.now(), stillAllowed = pilotRoutes(new Date(readAt), buses, periods, holidays);
  if (etaServiceDate(readAt) !== day) return { status: "learning", arrivals: [] };
  for (const id of Object.keys(plans)) if (patterns[Number(id)] !== servicePattern(routeNames[Number(id) - 1], new Date(readAt), buses, periods, holidays)) delete plans[Number(id)];
  const forecastExpiry=reused?Math.min(validUntil,prior!.validUntil):validUntil;
  scheduledProfiles = { version, live: profiles, history, validUntil:forecastExpiry };
  const compatible = live ? { ...live, runs: live.runs.filter(r => r.pattern === servicePattern(routeNames[r.routeId - 1], new Date(readAt), buses, periods, holidays)) } : undefined;
  const livePlans = Object.fromEntries(Object.entries(plans).filter(([id]) => stillAllowed.includes(Number(id))));
  return {
    status: "learning",
    arrivals: learningArrivals(compatible, history, livePlans, readAt, vehicleId === undefined ? undefined : shuttleVehicleKey(vehicleId, readAt)),
    ...(vehicleId === undefined ? scheduled(profiles,history,readAt,forecastExpiry) : {}),
    context:{...context,generatedAt:readAt,validUntil:forecastExpiry,...degraded?{degraded:true}:{}},
  };
}
