import type { ScheduledShuttleTrip, ScheduledStopArrival } from "@/lib/shuttle-eta";
import { etaServiceDate } from "@/lib/shuttle-eta";
import { serviceVisits } from "./service-visits";
import type { ServiceRoute } from "./service-data";

export type EstimatedProgress = { key:string; from:number; next:number; position:number; departureAt:number };

export function estimatedProgress(route:ServiceRoute,trips:readonly ScheduledShuttleTrip[],scheduled:ReadonlyMap<string,ScheduledStopArrival>,selected:number|null,now:number):EstimatedProgress|null {
  const visits=serviceVisits[route.id];
  const active=trips.filter(trip=>trip.route===route.id&&etaServiceDate(trip.departureAt)===etaServiceDate(now)&&
    trip.departureAt<=now&&trip.stops.length===visits.length&&trip.stops.every((stop,index)=>
      stop.visitId===visits[index].id&&stop.departureAt===trip.departureAt&&Number.isSafeInteger(stop.arrivalAt)&&
      (index===0?stop.arrivalAt===trip.departureAt:stop.arrivalAt>trip.stops[index-1].arrivalAt))&&
    now<trip.stops.at(-1)!.arrivalAt);
  const target=selected===null?undefined:scheduled.get(visits[selected]?.id);
  const trip=selected===null?active.sort((a,b)=>b.departureAt-a.departureAt)[0]:
    active.find(item=>target?.tripKey?item.key===target.tripKey:item.departureAt===target?.departureAt);
  if(!trip)return null;
  const next=trip.stops.findIndex(stop=>stop.arrivalAt>now);
  if(next<1)return null;
  const from=next-1;
  // shortcut: interpolate between predicted stop times; use measured segment progress when available.
  const position=from+(now-trip.stops[from].arrivalAt)/(trip.stops[next].arrivalAt-trip.stops[from].arrivalAt);
  return {key:trip.key,from,next,position,departureAt:trip.departureAt};
}
