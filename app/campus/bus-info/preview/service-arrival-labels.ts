import type { Locale } from "@/lib/i18n/routing";
import { getShuttlePreviewCopy } from "@/lib/i18n/shuttle-preview";
import { getShuttleServiceCopy } from "@/lib/i18n/shuttle-service-preview";
import { demoStopArrival } from "./service-demo";
import type { ServiceRoute } from "./service-data";
import { serviceVisits } from "./service-visits";
import type { ScheduledStopArrival } from "@/lib/shuttle-eta";
import { koreaDateKey } from "./preview-timetable";

type ScheduleContext = { now:Date; departures:string[]; scheduled:ReadonlyMap<string,ScheduledStopArrival>; progress:{position:number}[]; demoDepartures?:readonly number[]; demoEpoch?:number };

export function stopArrivalLabels(route: ServiceRoute, locale: Locale, sample: boolean, elapsed: number, nextAvailable: boolean, delayed: boolean, closed: boolean, estimates?: ReadonlyMap<string, number>, schedule?:ScheduleContext) {
  const copy = getShuttlePreviewCopy(locale), live = getShuttleServiceCopy(locale);
  const now=schedule?.now.getTime()??0,date=schedule?koreaDateKey(schedule.now):"";
  const departures=schedule?.departures.map(time=>({time,at:Date.parse(`${date}T${time}:00+09:00`)})).filter(item=>item.at>=now)??[];
  const followingDeparture=departures.find(item=>item.at>now);
  return route.stops.map((_, index) => {
    if(sample&&index===0&&schedule?.demoDepartures&&schedule.demoEpoch!==undefined) {
      const runs=nextAvailable?schedule.demoDepartures:schedule.demoDepartures.slice(0,1);
      const departure=runs.find(at=>at>=elapsed);
      const time=departure===undefined?null:new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(schedule.demoEpoch+departure*1000);
      const eta=time?`${time} ${live.departureAt}`:live.lastDeparted;
      return {verified:false,eta,detail:live.scheduleBasis,following:"",message:eta};
    }
    if(!sample&&!closed&&schedule) {
      if(index===0&&schedule.departures.length) {
        const departure=departures[0],minutes=departure?Math.ceil((departure.at-now)/60000):null;
        const eta=departure?`${departure.time} ${live.departureAt}`:live.lastDeparted;
        return {verified:false,eta,detail:minutes===null?"":`${minutes}${locale==="ko"?"":" "}${copy.minutes} · ${live.scheduleBasis}`,following:"",message:eta};
      }
    }
    const verified = !sample && !closed ? estimates?.get(serviceVisits[route.id][index].id) : undefined;
    if (verified !== undefined) {
      const time = `${verified}${locale === "ko" ? "" : " "}${copy.minutes}`;
      return { verified: true, eta: `${copy.approx} ${time}`, detail: "", following: "", message: live.arrivesIn.replace("{time}", time) };
    }
    const passed=!!schedule?.progress.length&&schedule.progress.every(bus=>bus.position>index+.03);
    let scheduled=!sample&&!closed?schedule?.scheduled.get(serviceVisits[route.id][index].id):undefined;
    if(scheduled&&schedule&&(scheduled.arrivalAt<now||passed&&scheduled.departureAt<=now)) {
      if(!followingDeparture)return {verified:false,eta:live.lastPassed,detail:passed?"":live.scheduleBasis,following:"",message:live.lastPassed};
      scheduled={...scheduled,departureAt:followingDeparture.at,arrivalAt:followingDeparture.at+scheduled.travelSeconds*1000};
    }
    if(scheduled&&schedule) {
      const minutes=Math.max(0,Math.ceil((scheduled.arrivalAt-now)/60000));
      const departure=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(scheduled.departureAt);
      const time=`${minutes}${locale==="ko"?"":" "}${copy.minutes}`;
      return {verified:false,eta:`${copy.approx} ${time}`,detail:`${departure} ${live.departureAt} · ${live.scheduleBasis}`,following:scheduled.departureAt>now?live.nextVehicle:"",message:live.arrivesIn.replace("{time}",time)};
    }
    if(!sample&&!closed&&passed&&schedule) {
      const eta=followingDeparture?live.arrivalUnknown:live.lastPassed;
      return {verified:false,eta,detail:"",following:followingDeparture?live.nextVehicle:"",message:eta};
    }
    const arrival = sample ? demoStopArrival(route, elapsed, index, nextAvailable, delayed,undefined,schedule?.demoDepartures) : null;
    const minutes = arrival?.seconds != null ? `${Math.ceil(arrival.seconds / 60)}${locale === "ko" ? "" : " "}${copy.minutes}` : "";
    let eta = closed ? live.dayClosed : live.stopEta;
    const detail = "";
    if (arrival) {
      switch (arrival.state) {
        case "approaching": eta = `${copy.approx} ${minutes}`; break;
        case "arrived": eta = copy.arrived; break;
        case "passed": eta = live.lastPassed; break;
        case "delayed": eta = live.arrivalUnknown; break;
      }
    }
    const following = arrival?.run != null && arrival.run > 0 ? live.nextVehicle : "";
    const message = arrival?.state === "approaching" ? live.arrivesIn.replace("{time}", minutes) : eta;
    return { verified: false, eta, detail, following, message: [following, message, detail].filter(Boolean).join(" · ") };
  });
}
