// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ShuttleSpecialPeriods } from "@/types";
import buses from "@/public/data/shuttle-bus-schedule.json";
import periods from "@/public/data/shuttle-special-periods.json";
import { AdminAuthError } from "@/lib/server/admin-auth";
import { GET, POST } from "./route";
const m = vi.hoisted(()=>({auth:vi.fn(), receiver:vi.fn(), calendar:vi.fn(), holidays:vi.fn(), db:vi.fn(), create:vi.fn()}));
vi.mock("@/lib/server/admin-auth",async original=>({...await original<typeof import("@/lib/server/admin-auth")>(),requireAdmin:m.auth}));
vi.mock("@/app/api/bus/shuttle/route",()=>({GET:m.receiver}));
vi.mock("@/lib/server/firestore",()=>({getFirestore:m.db,admin:{firestore:{Timestamp:{fromMillis:(n:number)=>n}}}}));
vi.mock("@/lib/server/home-data",()=>({getHomeShuttleBuses:()=>buses,getHomeShuttleSpecialPeriods:m.calendar,getHomePublicHolidays:m.holidays}));
const req = new Request("https://example.invalid/campus/bus-info/preview/locations",{method:"POST"});
const date = (day:string,time="12:00")=>new Date(`${day}T${time}:00+09:00`);
const weekday = date("2026-11-03");
const payload = () => ({success:true,stale:false,sourceStatus:"fresh",timestamp:new Date().toISOString(),data:[
  {id:"test-vehicle",name:"test-name",routeid:2,status:1,lat:37.62,lon:127.08}]});
const holiday = () => ({schemaVersion:1,sourceUrl:"",years:[2026],holidays:[],lastSuccessAt:new Date().toISOString()});
beforeEach(()=>{
  vi.useFakeTimers({toFake:["Date"]}); vi.setSystemTime(weekday);
  vi.stubEnv("VERCEL_ENV","production"); vi.stubEnv("RATE_LIMIT_SECRET","test-value-not-a-secret");
  m.auth.mockResolvedValue({uid:"admin"}); m.calendar.mockResolvedValue(periods as ShuttleSpecialPeriods);
  m.holidays.mockImplementation(holiday); m.receiver.mockImplementation(()=>Response.json(payload()));
  m.db.mockReturnValue({collection:()=>({doc:()=>({create:m.create})})}); m.create.mockResolvedValue({});
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();vi.resetAllMocks();});
it.each([["2026-10-31","00:00"],["2026-11-01","23:59"]])("does not access even the calendar, receiver or store on KST weekend %s %s",async(day,time)=>{
  vi.setSystemTime(date(day,time));
  expect((await (await GET()).json()).collection).toBe("closed");
  expect((await (await POST(req)).json()).collection).toBe("closed");
  for(const fn of [m.auth,m.calendar,m.receiver,m.db]) expect(fn).not.toHaveBeenCalled();
});
it.each(["holiday","uncertain","explicitClosure","outside","gap","weekendException"])("fails closed for %s",async mode=>{
  if(mode==="holiday") m.holidays.mockReturnValue({...holiday(),holidays:[{date:"2026-11-03",names:["test"]}]});
  if(mode==="uncertain") m.holidays.mockReturnValue({...holiday(),stale:true});
  if(mode==="explicitClosure") m.calendar.mockResolvedValue({...periods,closedDates:[{date:"2026-11-03"}]});
  if(mode==="outside") vi.setSystemTime(date("2026-11-03","06:30"));
  if(mode==="gap") vi.setSystemTime(date("2026-11-03","23:50"));
  if(mode==="weekendException"){vi.setSystemTime(date("2026-10-31"));m.calendar.mockResolvedValue({...periods,serviceExceptions:[{date:"2026-10-31",routeId:"shuttle-1",times:["12:00"]}]});}
  expect((await (await POST(req)).json()).collection).toBe("closed");
  expect(m.receiver).not.toHaveBeenCalled(); expect(m.db).not.toHaveBeenCalled();
});
it("authorizes writes and separates map reads, fresh receipts, duplicates and source timestamps",async()=>{
  expect((await (await GET()).json()).collection).toBe("ready");expect(m.db).not.toHaveBeenCalled();
  m.auth.mockRejectedValueOnce(new AdminAuthError("denied",403));
  expect((await POST(req)).status).toBe(403); expect(m.db).not.toHaveBeenCalled();
  const saved=await (await POST(req)).json();expect(saved).toMatchObject({collection:"saved",vehicles:1});
  const row=m.create.mock.calls[0][0];expect(row.measuredAt).toBeNull();expect(row.expires_at-row.receivedAt).toBe(30*86400_000);
  expect(JSON.stringify(row)).not.toContain("test-vehicle");expect(JSON.stringify(saved)).not.toContain("vehicleKey");
  m.create.mockRejectedValueOnce({code:6});expect((await (await POST(req)).json()).collection).toBe("duplicate");
});
it("does not save stale, wrong-route, off-hours, empty or local observations",async()=>{
  m.receiver.mockImplementationOnce(()=>Response.json({...payload(),stale:true}));
  expect((await (await POST(req)).json()).collection).toBe("delayed");
  m.receiver.mockImplementationOnce(()=>Response.json({...payload(),data:[]}));
  expect((await (await POST(req)).json()).collection).toBe("empty");
  m.receiver.mockImplementationOnce(()=>Response.json({...payload(),data:[{...payload().data[0],routeid:4}]}));
  expect((await (await POST(req)).json()).collection).toBe("empty");
  vi.stubEnv("VERCEL_ENV","preview");expect((await (await POST(req)).json()).collection).toBe("local");
  vi.stubEnv("VERCEL_ENV","production");m.receiver.mockImplementationOnce(()=>{const p=payload();vi.setSystemTime(date("2026-11-07"));return Response.json(p);});
  expect((await (await POST(req)).json()).collection).not.toBe("saved");expect(m.db).not.toHaveBeenCalled();
});
