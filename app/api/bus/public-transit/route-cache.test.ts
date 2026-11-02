// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const fetchArrivals = vi.hoisted(() => vi.fn());
vi.mock("@/lib/public-transit", () => ({fetchPublicTransitArrivals:fetchArrivals,getBusRouteKey:(a:{routeId:string})=>a.routeId}));
const t = Date.parse("2026-11-02T10:00:00Z");
function payload(count:number,partial=false) {
  return {data:[{stop:{id:"jungmun-up"},lastUpdated:new Date(),arrivals:Array.from({length:count},(_,i)=>({routeId:String(i),routeName:String(i),arrivalMsg1:"5분",predictTime1:5}))}],stale:false,sourceStatus:partial?"partial":"fresh",failures:[]};
}
beforeEach(()=>{vi.resetModules();vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(t);fetchArrivals.mockReset();});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
it("replaces a bus that disappeared after a healthy refresh without retaining stale arrivals",async()=>{
  const {GET}=await import("./route");
  fetchArrivals.mockResolvedValueOnce(payload(2)).mockResolvedValueOnce(payload(1));
  await GET();vi.setSystemTime(t+11000);
  const result=await(await GET()).json();
  expect(result).toMatchObject({stale:false,sourceStatus:"fresh",timestamp:new Date().toISOString()});
  expect(result.data[0].arrivals).toHaveLength(1);
});
it("keeps fresh partial results distinct from the cached fallback used on a full failure",async()=>{
  const {GET}=await import("./route");
  fetchArrivals.mockResolvedValueOnce(payload(1,true)).mockRejectedValue(new Error("offline"));
  const fresh=await(await GET()).json();
  expect(fresh).toMatchObject({stale:false,sourceStatus:"partial"});
  vi.spyOn(console,"error").mockImplementation(()=>undefined);
  vi.setSystemTime(t+11000);
  expect(await(await GET()).json()).toMatchObject({stale:true,sourceStatus:"stale",timestamp:fresh.timestamp});
  vi.setSystemTime(t+121000);expect((await GET()).status).toBe(502);
});
