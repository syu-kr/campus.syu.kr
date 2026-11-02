import type { Point } from "./preview-data";
import roadData from "./data/service-road-paths.json";
import { serviceVisits as visits } from "@/lib/shuttle-visits";
import { projectShuttlePoint } from "@/lib/shuttle-learning";
import type { BusLocation } from "@/types";
import type { ServiceRoute } from "./service-data";
export const serviceVisits: Record<string, typeof visits.seokgye> = visits;

const roads:Record<string,Point[][]>=Object.fromEntries(Object.entries(roadData.paths).map(([id,legs])=>[id,legs.map(path=>path.map(([lat,lon]):Point=>[lat,lon]))]));
export function serviceRoadPaths(route:{id:string}):Point[][] {return roads[route.id]??[];}
export function pointAlongPath(path:Point[],fraction:number):Point {
  const lengths=path.slice(1).map((p,i)=>Math.hypot((p[0]-path[i][0]),(p[1]-path[i][1])*Math.cos(p[0]*Math.PI/180)));
  let remaining=lengths.reduce((sum,length)=>sum+length,0)*Math.max(0,Math.min(1,fraction));
  for(let i=0;i<lengths.length;i++) {if(remaining<=lengths[i]) {const f=lengths[i]?remaining/lengths[i]:0;return [path[i][0]+(path[i+1][0]-path[i][0])*f,path[i][1]+(path[i+1][1]-path[i][1])*f];}remaining-=lengths[i];}
  return path.at(-1)!;
}
export function defaultServiceRoute(now:Date) {return Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Seoul",hour:"2-digit",hourCycle:"h23"}).format(now))<12?"hwarangdae":"seokgye";}

export function receivedProgress(route:ServiceRoute,locations:BusLocation[],stale:boolean) {
  if(stale)return [];
  const paths=serviceRoadPaths(route);
  return locations.filter(bus=>bus.routeid===route.locationRouteId&&(route.oneWay?bus.status===2:bus.status!==0)).flatMap(bus=>{
    const matches=paths.map((path,index)=>({index,...projectShuttlePoint([Number(bus.lat),Number(bus.lon)],path)}))
      .filter(item=>(route.oneWay||(bus.status===1?item.index<route.target:item.index>=route.target))&&item.distance<=200)
      .sort((a,b)=>a.distance-b.distance);
    if(!matches.length)return [];
    const position=matches[0].index+matches[0].fraction;
    return [{id:bus.id,position,next:Math.min(route.stops.length-1,Math.ceil(position))}];
  });
}
