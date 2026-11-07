import { expect,it } from "vitest";
import type { ScheduledShuttleTrip } from "@/lib/shuttle-eta";
import { serviceRoutes } from "./service-data";
import { serviceVisits } from "./service-visits";
import { estimatedProgress } from "./service-estimated-progress";

const route=serviceRoutes[1],t=Date.parse("2026-11-04T13:00:00+09:00");
function trip(departureAt:number):ScheduledShuttleTrip {
  return {key:String(departureAt),route:"seokgye",pattern:"semester",departureAt,stops:serviceVisits.seokgye.map((visit,index)=>({
    visitId:visit.id,departureAt,arrivalAt:departureAt+index*60000,travelSeconds:index*60,tripKey:String(departureAt),
  }))};
}
it("returns every active trip with its own progress instead of selecting only the newest departure",()=>{
  const first=trip(t),second=trip(t+120000);
  expect(estimatedProgress(route,[second,first],t+150000)).toEqual([
    {key:first.key,from:2,next:3,position:2.5,departureAt:t},
    {key:second.key,from:0,next:1,position:.5,departureAt:t+120000},
  ]);
});
it("keeps all three overlapping departures and removes only the trip that actually ends",()=>{
  const trips=[trip(t),trip(t+60000),trip(t+120000)];
  expect(estimatedProgress(route,trips,t+150000)).toHaveLength(3);
  expect(estimatedProgress(route,trips,t+300000).map(item=>item.key)).toEqual([trips[1].key,trips[2].key]);
});
it("excludes future, completed, wrong-day, malformed and duplicate trips",()=>{
  const first=trip(t);
  expect(estimatedProgress(route,[first],t-1)).toEqual([]);
  expect(estimatedProgress(route,[first],t+300000)).toEqual([]);
  expect(estimatedProgress(route,[trip(t-86400000)],t+30000)).toEqual([]);
  expect(estimatedProgress(route,[{...first,stops:[...first.stops].reverse()}],t+30000)).toEqual([]);
  expect(estimatedProgress(route,[first,first],t+30000)).toHaveLength(1);
});
it("moves every estimated bus continuously within its own trip",()=>{
  const first=trip(t);
  expect(estimatedProgress(route,[first],t+15000)[0].position).toBe(.25);
  expect(estimatedProgress(route,[first],t+45000)[0].position).toBe(.75);
  expect(estimatedProgress(route,[first],t+60000)[0].position).toBe(1);
  expect(estimatedProgress(route,[first],t+90000)[0].position).toBe(1.5);
});
