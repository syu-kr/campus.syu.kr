import type { BusLocation } from "@/types";
import type { ServiceRoute } from "./service-data";
import { pointAlongPath, serviceRoadPaths } from "./service-visits";

// Demonstration timings, not live GPS; positions follow the stored road geometry.
const profiles:Record<string,{start:number;arrivals:number[];departures:number[]}>= {
  hwarangdae:{start:-180,arrivals:[0,480],departures:[120,500]},
  "hwarangdae-outbound":{start:0,arrivals:[0,900],departures:[0,920]},
  seokgye:{start:-300,arrivals:[0,240,420,660,840,1260],departures:[0,260,440,680,860,1280]},
  byeollae:{start:-180,arrivals:[0,540,1080],departures:[0,560,1100]},
};
export function demoEventTime(route:ServiceRoute,stop:number,passed=false) {
  const profile=profiles[route.id];
  return profile.start+(passed?profile.departures[stop]+1:profile.arrivals[stop]);
}
export function demoStopArrival(route:ServiceRoute,elapsed:number,stop:number,nextAvailable:boolean,delayed=false,runOnly?:number) {
  const profile=profiles[route.id];
  if(delayed) return {state:"delayed" as const,seconds:null,run:null};
  for(const run of nextAvailable?[0,1]:[0]) {
    if(runOnly!==undefined&&run!==runOnly) continue;
    const arrival=profile.start+run*720+profile.arrivals[stop];
    const departure=profile.start+run*720+profile.departures[stop];
    if(elapsed>departure) continue;
    return {state:elapsed<arrival?"approaching" as const:stop===0&&elapsed<departure?"waiting" as const:"arrived" as const,
      seconds:Math.max(0,(stop===0&&elapsed>=arrival?departure:arrival)-elapsed),run};
  }
  return {state:"passed" as const,seconds:null,run:null};
}
export function demoProgress(route:ServiceRoute,elapsed:number,nextAvailable:boolean) {
  const profile=profiles[route.id];
  return (nextAvailable?[0,1]:[0]).flatMap(run=>{
    const progress=elapsed-profile.start-run*720;
    // Before the origin we have an arrival time, but no position on this trip's path.
    if(progress<0||progress>profile.departures.at(-1)!) return [];
    let position=0;
    for(let i=0;i<profile.arrivals.length-1;i++) {
      if(progress>=profile.arrivals[i+1]) {position=i+1;continue;}
      position=i+Math.max(0,Math.min(1,(progress-profile.departures[i])/(profile.arrivals[i+1]-profile.departures[i])));break;
    }
    return [{id:`demo-${route.id}-${run}`,run,position,next:Math.min(route.stops.length-1,Math.ceil(position))}];
  });
}
export function demoLocations(route:ServiceRoute,elapsed:number,nextAvailable:boolean):BusLocation[] {
  const paths=serviceRoadPaths(route);
  return demoProgress(route,elapsed,nextAvailable).map(bus=>{
    const segment=Math.min(paths.length-1,Math.floor(bus.position));
    const point=pointAlongPath(paths[segment],bus.position-segment);
    return {id:bus.id,name:"demo",lat:String(point[0]),lon:String(point[1]),status:1,routeid:route.locationRouteId as BusLocation["routeid"]};
  });
}
