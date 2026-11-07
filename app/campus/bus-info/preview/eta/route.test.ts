import {afterEach,beforeEach,expect,it,vi} from "vitest";
import buses from "@/public/data/shuttle-bus-schedule.json";
import calendar from "@/public/data/shuttle-special-periods.json";
import type {PublicHolidaySnapshot,ShuttleSpecialPeriods} from "@/types";
import {servicePattern} from "@/lib/server/shuttle-eta";
import {advanceShuttleLearning} from "@/lib/shuttle-learning";
import {pointAlongPath,serviceRoadPaths} from "../service-visits";
import {shuttleVehicleKey} from "@/lib/server/shuttle-vehicle";
let GET: typeof import("./route").GET;
const m=vi.hoisted(()=>({get:vi.fn(),buses:vi.fn(),holidays:vi.fn(),periods:vi.fn(),source:"firebase-storage"}));
vi.mock("@/lib/server/shuttle-service-data",()=>({loadShuttleServiceData:async()=>({
  buses:await m.buses(),specialPeriods:await m.periods(),holidays:await m.holidays(),source:m.source,version:"test",nowISO:new Date().toISOString(),
})}));
vi.mock("@/lib/server/firestore",()=>({getFirestore:()=>({collection:()=>({doc:(id:string)=>({get:()=>m.get(id)})})})}));
const now=Date.parse("2026-11-03T15:00:00+09:00"),periods=calendar as ShuttleSpecialPeriods;
const holidays:PublicHolidaySnapshot={schemaVersion:1,sourceUrl:"",years:[2026],lastSuccessAt:new Date(now-1000).toISOString(),holidays:[]};
function current() {
  return {schemaVersion:3,...advanceShuttleLearning(undefined,[.2,.6].map((fraction,i)=>{
    const p=pointAlongPath(serviceRoadPaths({id:"seokgye"})[3],fraction);
    return {vehicleKey:shuttleVehicleKey(`test-bus-${i}`,now),runId:`private-run-${i}`,routeId:2 as const,status:2 as const,pattern:"mondayToThursday",observedAt:now,measuredAt:now,measurementSource:"receiver" as const,advanced:true,lat:p[0],lon:p[1]};
  }),[],now)};
}
beforeEach(async()=>{
  vi.resetModules();({GET}=await import("./route"));
  m.source="firebase-storage";
  vi.stubEnv("RATE_LIMIT_SECRET","synthetic-test-secret");vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(now);
  m.buses.mockResolvedValue(buses);m.holidays.mockResolvedValue(holidays);m.periods.mockResolvedValue(periods);
  m.get.mockImplementation(async id=>({data:()=>id==="current"?current():{profiles:{"seokgye-4":{seconds:300,n:259,cells:{}}}}}));
});
it.each(["imported-snapshot","bundled-fallback","unavailable"])("withholds ETA and model reads when the service data is %s",async source=>{
  m.source=source;
  expect(await(await GET()).json()).toEqual({status:"learning",arrivals:[]});
  expect(m.get).not.toHaveBeenCalled();
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();vi.resetAllMocks();});
it("starts learning estimates from actual inputs and a historical prior without a field-release gate",async()=>{
  const response=await GET(),body=await response.json();
  expect(response.headers.get("cache-control")).toContain("s-maxage=5");
  expect(body.status).toBe("learning");expect(body.arrivals.length).toBeGreaterThan(0);
  expect(body.arrivals[0]).toMatchObject({basis:"history",measurementSource:"receiver",validUntil:now+90000});
  expect(JSON.stringify(body)).not.toMatch(/private-run|vehicleKey|\blat\b|\blon\b/);
});
it("isolates selected-vehicle predictions rather than substituting a faster bus",async()=>{
  const a=await GET(new Request("https://example.invalid/preview/eta?vehicleId=test-bus-0"));
  const b=await GET(new Request("https://example.invalid/preview/eta?vehicleId=test-bus-1"));
  expect(a.headers.get("cache-control")).toBe("private, no-store");
  const first=(await a.json()).arrivals.find((r:{visitId:string})=>r.visitId==="seokgye-taereung-7");
  const second=(await b.json()).arrivals.find((r:{visitId:string})=>r.visitId==="seokgye-taereung-7");
  expect(first.arrivalAt-now).toBeCloseTo(240000,-3);expect(second.arrivalAt-now).toBeCloseTo(120000,-3);
  expect(m.get.mock.calls.map(call=>call[0])).toEqual(["current","history"]);
});
it("coalesces concurrent viewer and selected-vehicle state reads",async()=>{
  await Promise.all(Array.from({length:10},(_,i)=>GET(i%2?new Request("https://example.invalid/preview/eta?vehicleId=test-bus-0"):undefined)));
  expect(m.get.mock.calls.map(call=>call[0])).toEqual(["current","history"]);
});
it("serves an hour after closure without repeated state or model reads",async()=>{
  vi.setSystemTime(Date.parse("2026-11-03T22:00:00+09:00"));
  const first=await(await GET()).json();
  expect(first.arrivals).toEqual([]);expect(first.scheduledArrivals.length).toBeGreaterThan(0);
  expect(m.get.mock.calls.map(call=>call[0])).toEqual(["history","model"]);
  m.get.mockClear();
  for(let minute=1;minute<=60;minute++) {
    vi.setSystemTime(Date.parse("2026-11-03T22:00:00+09:00")+minute*60000);
    await GET();await GET(new Request("https://example.invalid/preview/eta?vehicleId=test-bus-0"));
  }
  expect(m.get).not.toHaveBeenCalled();
});
it("serves timetable-based upcoming trips from the model even without a fresh vehicle fix",async()=>{
  m.get.mockImplementation(async id=>({data:()=>id==="current"?undefined:{profiles:{"seokgye-campus-departure":{seconds:600,n:30,cells:{}}}}}));
  const body=await(await GET()).json();
  expect(body.arrivals).toEqual([]);
  const first=body.scheduledArrivals.find((r:{visitId:string})=>r.visitId==="seokgye-hwarangdae-2");
  expect(first.travelSeconds).toBe(600);expect(first.arrivalAt-first.departureAt).toBe(600000);
  expect(body.scheduledArrivals.find((r:{visitId:string})=>r.visitId==="seokgye-campus-departure").travelSeconds).toBe(0);
  expect(JSON.stringify(body)).not.toMatch(/private-run|vehicleKey|measuredAt|\blat\b|\blon\b/);
});
it.each(["vehicleId=","vehicleId=..%2Fprivate","vehicleId="+"a".repeat(129),"vehicleId=one&vehicleId=two"])("rejects invalid selectors before data access: %s",async query=>{
  expect((await GET(new Request(`https://example.invalid/preview/eta?${query}`))).status).toBe(400);expect(m.get).not.toHaveBeenCalled();
});
it("keeps stale observations out while preserving known scheduled estimates on a current read error",async()=>{
  const saved=current();m.get.mockResolvedValue({data:()=>saved});vi.setSystemTime(now+90000);
  expect((await(await GET()).json()).arrivals).toEqual([]);
  vi.setSystemTime(now+121000);m.get.mockRejectedValueOnce(new Error("private detail"));
  const degraded=await(await GET()).json();
  expect(degraded.arrivals).toEqual([]);expect(degraded.scheduledArrivals.length).toBeGreaterThan(0);expect(degraded.context.degraded).toBe(true);
  m.get.mockClear();m.holidays.mockResolvedValue({...holidays,stale:true});expect((await(await GET()).json()).arrivals).toEqual([]);expect(m.get).not.toHaveBeenCalled();
  m.holidays.mockClear();vi.setSystemTime(Date.parse("2026-11-07T15:00:00+09:00"));
  expect((await(await GET()).json()).arrivals).toEqual([]);expect(m.holidays).not.toHaveBeenCalled();
});
it("publishes schedule identity, bounded trip visits and a fixed five-minute outage grace",async()=>{
  const first=await(await GET()).json();
  expect(first.context).toMatchObject({serviceDate:"2026-11-03",version:"test",generatedAt:now,validUntil:now+300000});
  expect(first.trips.length).toBeGreaterThan(0);
  expect(first.trips.every((trip:{key:string;stops:{tripKey:string}[]})=>trip.stops.every(stop=>stop.tripKey===trip.key))).toBe(true);
  vi.setSystemTime(now+61000);m.get.mockRejectedValue(new Error("private storage failure"));
  const fallback=await(await GET()).json();
  expect(fallback.context).toMatchObject({degraded:true,validUntil:now+300000});
  expect(fallback.arrivals).toEqual([]);expect(fallback.scheduledArrivals.length).toBeGreaterThan(0);
  vi.setSystemTime(now+301000);expect((await GET()).status).toBe(503);
});
it("does not replace a failed initial history read with a road-only model",async()=>{
  m.get.mockImplementation(async id=>{if(id==="history")throw new Error("private history failure");return{data:()=>current()};});
  const response=await GET();expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain("private history");
});
it("keeps pre-service predictions valid to the collection opening without adding idle reads",async()=>{
  const morning=Date.parse("2026-11-03T07:00:00+09:00");vi.setSystemTime(morning);
  m.holidays.mockResolvedValue({...holidays,lastSuccessAt:new Date(morning-1000).toISOString()});
  const first=await(await GET()).json();
  expect(first.context.validUntil).toBe(Date.parse("2026-11-03T07:40:00+09:00"));
  m.get.mockClear();vi.setSystemTime(morning+30*60000);await GET();expect(m.get).not.toHaveBeenCalled();
});
it("reuses same-version history after a failed refresh without extending its outage deadline",async()=>{
  await GET();
  const cache=await import("@/lib/server/shuttle-eta-cache");
  vi.spyOn(cache,"readShuttleHistory").mockRejectedValue(new Error("private history error"));
  vi.setSystemTime(now+10000);
  const body=await(await GET()).json();
  expect(body.context).toMatchObject({degraded:true,validUntil:now+300000});
  expect(body.scheduledArrivals.length).toBeGreaterThan(0);
});
it("bounds scheduled validity at holiday expiration and publishes authoritative empty service results",async()=>{
  m.holidays.mockResolvedValue({...holidays,lastSuccessAt:new Date(now-3*86400000+60000).toISOString()});
  const first=await(await GET()).json();expect(first.context.validUntil).toBe(now+60000);
  m.periods.mockResolvedValue({...periods,closedDates:[{date:"2026-11-03",reason:"test"}]});
  const closed=await(await GET()).json();
  expect(closed).toMatchObject({arrivals:[],scheduledArrivals:[],trips:[],context:{version:"test",serviceDate:"2026-11-03"}});
});
it("runs the isolated synthetic check without a database read or collection",async()=>{
  expect(await(await GET(new Request("https://example.invalid/preview/eta?check=1"))).json()).toEqual({source:"synthetic",passed:true});
  expect(m.get).not.toHaveBeenCalled();expect(m.buses).not.toHaveBeenCalled();
});
it("retains actual route-specific calendar patterns while showing the global online category",()=>{
  const date=new Date("2026-11-02T15:00:00+09:00"),h={...holidays,lastSuccessAt:date.toISOString()};
  expect(servicePattern("seokgye",date,buses,periods,h)).toContain("online-class-week-fall-2026");
  expect(servicePattern("byeollae",date,buses,periods,h)).toBe("mondayToThursday");
});
