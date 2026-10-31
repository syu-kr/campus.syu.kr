import type { PreviewVehicleId } from "./preview-vehicles";

export type Point = readonly [number, number];
export type StopName = "school" | "hwarangdae" | "taereung" | "seokgye" | "byeollae";
export type PreviewMode = "normal" | "delayed" | "ended";
export type PreviewDirection = "campus" | "station";
export type PreviewScheduleType = "regular" | "special";
export type PreviewRun = { runId: string; vehicleId: PreviewVehicleId; departure: number };
export type PreviewRoute = {
  id: string; name: StopName; target: number; color: string; oneWay?: boolean;
  stops: { name: StopName; exit?: number; point: Point }[];
  legs: { seconds: number; path: Point[]; detour?: boolean }[];
};
const school: Point = [37.64356, 127.1053];
const hwarang2: Point = [37.62038, 127.08392];
const hwarang5: Point = [37.61992, 127.08597];
const taereung6: Point = [37.61792, 127.076];
const taereung7: Point = [37.61765, 127.07607];
const seokgye: Point = [37.61481, 127.06675];
const byeollae: Point = [37.64219, 127.1268];

// Preview paths are illustrative geometry, not verified road alignments.
export const previewRoutes: PreviewRoute[] = [
  { id:"hwarangdae",name:"hwarangdae",color:"#3b82f6",target:1,oneWay:true,
    stops:[{name:"hwarangdae",exit:5,point:hwarang5},{name:"school",point:school}],
    legs:[{seconds:360,path:[hwarang5,[37.629,127.096],[37.6382,127.1075],school]}] },
  { id: "seokgye", name: "seokgye", color: "#10b981", target: 3,
    stops: [{name:"school",point:school},{name:"hwarangdae",exit:2,point:hwarang2},{name:"taereung",exit:6,point:taereung6},{name:"seokgye",exit:4,point:seokgye},{name:"taereung",exit:7,point:taereung7},{name:"school",point:school}],
    legs: [
      {seconds:240,path:[school,[37.6382,127.1075],[37.6302,127.0983],hwarang2]},
      {seconds:90,path:[hwarang2,taereung6]}, {seconds:120,path:[taereung6,seokgye]},
      {seconds:150,path:[seokgye,[37.6139,127.071],taereung7]},
      {seconds:300,path:[taereung7,[37.623,127.089],[37.6382,127.1075],school]},
    ] },
  { id:"byeollae",name:"byeollae",color:"#f59e0b",target:1,
    stops:[{name:"school",point:school},{name:"byeollae",exit:2,point:byeollae},{name:"school",point:school}],
    legs:[{seconds:360,path:[school,[37.648,127.11],[37.647,127.12],byeollae]},
      {seconds:420,path:[byeollae,[37.638,127.117],[37.64,127.109],school]}] },
];
export const hwarangdaeOutbound: PreviewRoute = {
  id:"hwarangdae-outbound",name:"hwarangdae",color:"#3b82f6",target:1,oneWay:true,
  stops:[{name:"school",point:school},{name:"hwarangdae",exit:5,point:hwarang5}],
  legs:[{seconds:540,detour:true,path:[school,[37.6382,127.1075],[37.625,127.092],[37.615,127.101],[37.612,127.091],[37.617,127.084],hwarang5]}],
};
export function journeyStops(route: PreviewRoute, direction: PreviewDirection): number[] {
  const start=route.oneWay||direction==="station"?0:route.target;
  const end=route.oneWay||direction==="campus"?route.stops.length-1:route.target;
  return Array.from({length:end-start+1},(_,i)=>start+i);
}
export function initialElapsed(route: PreviewRoute): number {
  return route.oneWay?-120:120;
}
export function arrivalTimes(route: PreviewRoute): number[] {
  const times=[0];
  route.legs.forEach((leg,i)=>times.push(times[i]+(i>0?20:0)+leg.seconds));
  return times;
}
export function getPreviewEta(route: PreviewRoute, elapsed: number, target: number, mode: PreviewMode) {
  if(mode!=="normal") return {state:mode,seconds:null};
  const arrival=arrivalTimes(route)[target];
  if(arrival<=elapsed) return {state:elapsed-arrival<20?"arrived":"passed",seconds:null};
  return {state:"approaching",seconds:arrival-elapsed};
}
export function previewDepartures(route: PreviewRoute, type: PreviewScheduleType, friday = false): string[] {
  // shortcut: Sample service profiles; replace with verified route/day schedules for live service.
  if(type === "special") return route.oneWay
    ? ["12:00", "12:20", "12:40"]
    : friday ? ["12:00", "12:45", "13:30"] : ["12:00", "12:45", "13:30", "14:15"];
  return route.oneWay ? ["12:00", "12:15", "12:30", "12:45"]
    : friday ? ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00"]
      : ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"];
}
export function previewRuns(route: PreviewRoute, type: PreviewScheduleType, nextAvailable: boolean, vehicleId: PreviewVehicleId = "preview-bus-a"): PreviewRun[] {
  const next = previewDepartures(route, type)[1].split(":").map(Number);
  const followingVehicleId: PreviewVehicleId = vehicleId === "preview-bus-b" ? "preview-bus-a" : "preview-bus-b";
  return [
    {runId:`${route.id}:${type}:12:00`,vehicleId,departure:0},
    ...(nextAvailable ? [{runId:`${route.id}:${type}:${next.join(":")}`,vehicleId:followingVehicleId,departure:(next[0]*60+next[1]-720)*60}] : []),
  ];
}
export function getStopArrival(route: PreviewRoute, elapsed: number, target: number, mode: PreviewMode, runs: PreviewRun[]) {
  if(mode!=="normal") return {state:mode,seconds:null,runId:null,vehicleId:null,scheduled:false};
  const candidates = runs.map(run => ({
    ...getPreviewEta(route,elapsed-run.departure,target,mode), runId:run.runId, vehicleId:run.vehicleId, scheduled:run.departure>elapsed,
  })).filter(result => result.state==="approaching"||result.state==="arrived");
  candidates.sort((a,b)=>(a.seconds??0)-(b.seconds??0)||a.runId.localeCompare(b.runId));
  return candidates[0]??{state:"passed",seconds:null,runId:null,vehicleId:null,scheduled:false};
}
export function runningVehicleTrips(route: PreviewRoute, elapsed: number, runs: PreviewRun[]): PreviewRun[] {
  const duration = arrivalTimes(route).at(-1)! + 20;
  return runs.filter(run => elapsed >= run.departure && elapsed <= run.departure + duration)
    .sort((a,b) => b.departure-a.departure || a.runId.localeCompare(b.runId))
    .filter((run,index,active) => active.findIndex(other => other.vehicleId === run.vehicleId) === index);
}
export function positionOnRoute(route: PreviewRoute, elapsed: number): Point {
  const times=arrivalTimes(route);
  for(let i=0;i<route.legs.length;i++) {
    if(elapsed<times[i]+(i>0?20:0)) return route.stops[i].point;
    if(elapsed>=times[i+1]) continue;
    const leg=route.legs[i],fraction=Math.max(0,(elapsed-times[i]-(i>0?20:0))/leg.seconds);
    const distances=leg.path.slice(1).map((p,j)=>Math.hypot(p[0]-leg.path[j][0],(p[1]-leg.path[j][1])*.79));
    let remaining=distances.reduce((a,b)=>a+b,0)*fraction;
    for(let j=0;j<distances.length;j++) {
      if(remaining<=distances[j]) { const ratio=distances[j]?remaining/distances[j]:0; return [leg.path[j][0]+ratio*(leg.path[j+1][0]-leg.path[j][0]),leg.path[j][1]+ratio*(leg.path[j+1][1]-leg.path[j][1])]; }
      remaining-=distances[j];
    }
  }
  return route.stops.at(-1)!.point;
}
