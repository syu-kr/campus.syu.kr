import type { Locale } from "@/lib/i18n/routing";
import { getShuttlePreviewCopy } from "@/lib/i18n/shuttle-preview";
import { getShuttleServiceCopy } from "@/lib/i18n/shuttle-service-preview";
import { demoStopArrival } from "./service-demo";
import type { ServiceRoute } from "./service-data";
import { serviceVisits } from "./service-visits";
import type { ScheduledStopArrival, ScheduledShuttleTrip, StopEta } from "@/lib/shuttle-eta";
import { koreaDateKey } from "./preview-timetable";

type ScheduleContext = { now:Date; departures:string[]; scheduled:ReadonlyMap<string,ScheduledStopArrival>; progress:{position:number}[]; observations?:ReadonlyMap<string,StopEta>; trips?:readonly ScheduledShuttleTrip[]; demoDepartures?:readonly number[]; demoEpoch?:number };
export type ArrivalLabel = { verified:boolean; eta:string; detail:string; following:string; message:string; arrivalClock?:string; source?:"observed"|"scheduled"; basis?:StopEta["basis"]; measuredAt?:number; tripKey?:string };
const LAST_ARRIVAL_GRACE_MS=10*60_000;

export function stopArrivalLabels(route: ServiceRoute, locale: Locale, sample: boolean, elapsed: number, nextAvailable: boolean, delayed: boolean, closed: boolean, estimates?: ReadonlyMap<string, number>, schedule?:ScheduleContext):ArrivalLabel[] {
  const copy = getShuttlePreviewCopy(locale), live = getShuttleServiceCopy(locale);
  const now=schedule?.now.getTime()??0,date=schedule?koreaDateKey(schedule.now):"";
  const allDepartures=schedule?.departures.map(time=>({time,at:Date.parse(`${date}T${time}:00+09:00`)})).filter(item=>Number.isFinite(item.at)).sort((a,b)=>a.at-b.at)??[];
  const departures=allDepartures.filter(item=>item.at>now);
  const clock=(at:number)=>new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(at);
  return route.stops.map((_, index) => {
    if(sample&&index===0&&schedule?.demoDepartures&&schedule.demoEpoch!==undefined) {
      const runs=nextAvailable?schedule.demoDepartures:schedule.demoDepartures.slice(0,1);
      const departure=runs.find(at=>at>=elapsed);
      const time=departure===undefined?null:new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(schedule.demoEpoch+departure*1000);
      const eta=time?`${time} ${live.departureAt}`:live.lastDeparted;
      return {verified:false,eta,detail:"",following:"",message:eta};
    }
    if(!sample&&!closed&&schedule) {
      if(index===0&&schedule.departures.length) {
        const departure=departures[0],minutes=departure?Math.ceil((departure.at-now)/60000):null;
        const eta=departure?`${departure.time} ${live.departureAt}`:live.lastDeparted;
        return {verified:false,eta,detail:minutes===null?"":`${minutes}${locale==="ko"?"":" "}${copy.minutes}`,following:"",message:eta};
      }
    }
    const verified = !sample && !closed ? estimates?.get(serviceVisits[route.id][index].id) : undefined;
    if (verified !== undefined) {
      const time = `${verified}${locale === "ko" ? "" : " "}${copy.minutes}`;
      const observation=schedule?.observations?.get(serviceVisits[route.id][index].id);
      return { verified: true, eta: `${copy.approx} ${time}`, detail: "", following: "", message: live.arrivesIn.replace("{time}", time),
        source:"observed",arrivalClock:observation?clock(observation.arrivalAt):undefined,basis:observation?.basis,measuredAt:observation?.measuredAt };
    }
    const visitId=serviceVisits[route.id][index].id;
    const cached=!sample&&!closed?schedule?.scheduled.get(visitId):undefined;
    const candidates=!sample&&!closed?(schedule?.trips??[]).filter(trip=>trip.route===route.id).flatMap(trip=>trip.stops.filter(stop=>stop.visitId===visitId)):[];
    if(cached)candidates.push(cached);
    const finalArrival=candidates.find(item=>item.departureAt===allDepartures.at(-1)?.at);
    // This completes the display only; it must not create an observed arrival or learning sample.
    if(finalArrival&&now>=finalArrival.arrivalAt+LAST_ARRIVAL_GRACE_MS) {
      return {verified:false,eta:live.lastPassed,detail:"",following:"",message:live.lastPassed};
    }
    const scheduled=candidates.filter(item=>item.arrivalAt>now).sort((a,b)=>a.arrivalAt-b.arrivalAt)[0];
    if(scheduled&&schedule) {
      const minutes=Math.max(0,Math.ceil((scheduled.arrivalAt-now)/60000));
      const departure=clock(scheduled.departureAt);
      const time=`${minutes}${locale==="ko"?"":" "}${copy.minutes}`;
      return {verified:false,eta:`${copy.approx} ${time}`,detail:live.expectedTrip.replace("{time}",departure),following:scheduled.departureAt>now?live.nextVehicle:"",message:live.arrivesIn.replace("{time}",time),
        source:"scheduled",arrivalClock:clock(scheduled.arrivalAt),basis:scheduled.basis,tripKey:scheduled.tripKey};
    }
    if(!sample&&!closed&&candidates.length&&schedule) {
      const eta=departures.length?live.arrivalUnknown:live.expectedEnded;
      return {verified:false,eta,detail:"",following:"",message:eta};
    }
    const arrival = sample ? demoStopArrival(route, elapsed, index, nextAvailable, delayed,undefined,schedule?.demoDepartures) : null;
    const minutes = arrival?.seconds != null ? `${Math.ceil(arrival.seconds / 60)}${locale === "ko" ? "" : " "}${copy.minutes}` : "";
    let eta = closed ? live.dayClosed : live.stopEta;
    const detail = "";
    if (arrival) {
      switch (arrival.state) {
        case "approaching": eta = `${copy.approx} ${minutes}`; break;
        case "arrived": eta = arrival.run===(nextAvailable?(schedule?.demoDepartures?.length??1):1)-1?live.lastPassed:copy.arrived; break;
        case "passed": eta = live.lastPassed; break;
        case "delayed": eta = live.arrivalUnknown; break;
      }
    }
    const following = arrival?.run != null && arrival.run > 0 ? live.nextVehicle : "";
    const message = arrival?.state === "approaching" ? live.arrivesIn.replace("{time}", minutes) : eta;
    return { verified: false, eta, detail, following, message: [following, message, detail].filter(Boolean).join(" · "),
      arrivalClock:arrival?.state==="approaching"&&arrival.seconds!==null&&schedule?.demoEpoch!==undefined?clock(schedule.demoEpoch+elapsed*1000+arrival.seconds*1000):undefined };
  });
}
