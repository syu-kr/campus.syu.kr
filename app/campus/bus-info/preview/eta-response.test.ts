import { expect, it } from "vitest";
import { nextScheduledShuttleArrivals, scheduledShuttleTrips } from "@/lib/shuttle-learning";
import { parseEtaResponse } from "./eta-response";

const departureAt=Date.parse("2026-11-04T13:00:00+09:00");
it("accepts backend trip totals above the per-leg two-hour limit",()=>{
  const profiles={"seokgye-campus-departure":{seconds:7100,n:30,cells:{}}};
  const trips=scheduledShuttleTrips({},profiles,{2:[departureAt]},{2:"mondayToThursday"},departureAt-60000);
  const scheduledArrivals=nextScheduledShuttleArrivals(trips,departureAt-60000);
  expect(trips[0].stops.at(-1)!.travelSeconds).toBeGreaterThan(7200);
  expect(parseEtaResponse({status:"learning",arrivals:[],trips,scheduledArrivals}).scheduledArrivals).toEqual(scheduledArrivals);
});
it("rejects cross-day or inconsistent travel totals while allowing rounded legacy seconds",()=>{
  const row={visitId:"seokgye-4",departureAt,arrivalAt:departureAt+100500,travelSeconds:101};
  const response=(stop:typeof row)=>({status:"learning",arrivals:[],scheduledArrivals:[stop]});
  expect(parseEtaResponse(response(row)).scheduledArrivals).toEqual([row]);
  expect(()=>parseEtaResponse(response({...row,travelSeconds:103}))).toThrow();
  expect(()=>parseEtaResponse(response({...row,departureAt:Date.parse("2026-11-04T23:59:00+09:00"),arrivalAt:Date.parse("2026-11-05T00:01:00+09:00"),travelSeconds:120}))).toThrow();
});
it("rejects timestamps outside the JavaScript date range before the render-time date checks",()=>{
  expect(()=>parseEtaResponse({status:"learning",arrivals:[{visitId:"seokgye-4",arrivalAt:Number.MAX_SAFE_INTEGER,
    measuredAt:departureAt,validUntil:departureAt+90000}]})).toThrow();
});
