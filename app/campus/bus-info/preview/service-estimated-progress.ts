import type { ScheduledShuttleTrip } from "@/lib/shuttle-eta";
import { etaServiceDate } from "@/lib/shuttle-eta";
import { serviceVisits } from "./service-visits";
import type { ServiceRoute } from "./service-data";

export type EstimatedProgress = { key:string; from:number; next:number; position:number; departureAt:number };

export function estimatedProgress(route:ServiceRoute,trips:readonly ScheduledShuttleTrip[],now:number):EstimatedProgress[] {
  const visits=serviceVisits[route.id];
  const active=trips.filter(trip=>trip.route===route.id&&etaServiceDate(trip.departureAt)===etaServiceDate(now)&&
    trip.departureAt<=now&&trip.stops.length===visits.length&&trip.stops.every((stop,index)=>
      stop.visitId===visits[index].id&&stop.departureAt===trip.departureAt&&Number.isSafeInteger(stop.arrivalAt)&&
      (index===0?stop.arrivalAt===trip.departureAt:stop.arrivalAt>trip.stops[index-1].arrivalAt))&&
    now<trip.stops.at(-1)!.arrivalAt);
  const seen=new Set<string>();
  return active.sort((a,b)=>a.departureAt-b.departureAt).flatMap(trip=>{
    if(seen.has(trip.key))return [];
    seen.add(trip.key);
    const next=trip.stops.findIndex(stop=>stop.arrivalAt>now);
    if(next<1)return [];
    const from=next-1;
    // shortcut: interpolate between predicted stop times; use measured segment progress when available.
    const position=from+(now-trip.stops[from].arrivalAt)/(trip.stops[next].arrivalAt-trip.stops[from].arrivalAt);
    return [{key:trip.key,from,next,position,departureAt:trip.departureAt}];
  });
}
