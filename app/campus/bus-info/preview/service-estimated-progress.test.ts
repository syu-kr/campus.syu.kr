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
it("shows one named active trip, and never builds progress from mixed next-per-stop arrivals",()=>{
  const first=trip(t),second=trip(t+120000),now=t+150000;
  const scheduled=new Map([[serviceVisits.seokgye[3].id,first.stops[3]],[serviceVisits.seokgye[1].id,second.stops[1]]]);
  expect(estimatedProgress(route,[first,second],scheduled,null,now)).toMatchObject({key:second.key,from:0,next:1});
  expect(estimatedProgress(route,[first,second],scheduled,3,now)).toMatchObject({key:first.key,from:2,next:3});
  expect(estimatedProgress(route,[first,second],scheduled,1,t+60000)).toBeNull();
  expect(estimatedProgress(route,[first],scheduled,null,t-1)).toBeNull();
  expect(estimatedProgress(route,[first],scheduled,null,t+300000)).toBeNull();
  expect(estimatedProgress(route,[{...first,stops:[...first.stops].reverse()}],scheduled,null,now)).toBeNull();
});
it("moves the estimated bus continuously between the same trip's predicted stops",()=>{
  const first=trip(t),scheduled=new Map([[serviceVisits.seokgye[1].id,first.stops[1]]]);
  expect(estimatedProgress(route,[first],scheduled,null,t+15000)?.position).toBe(.25);
  expect(estimatedProgress(route,[first],scheduled,null,t+45000)?.position).toBe(.75);
  expect(estimatedProgress(route,[first],scheduled,null,t+60000)?.position).toBe(1);
  expect(estimatedProgress(route,[first],scheduled,null,t+90000)?.position).toBe(1.5);
});
