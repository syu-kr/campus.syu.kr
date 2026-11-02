// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ShuttleSpecialPeriods } from "@/types";
import buses from "@/public/data/shuttle-bus-schedule.json";
import periods from "@/public/data/shuttle-special-periods.json";
import { AdminAuthError } from "@/lib/server/admin-auth";
let GET: typeof import("./route").GET, POST: typeof import("./route").POST;
const m = vi.hoisted(()=>({auth:vi.fn(), receiver:vi.fn(), calendar:vi.fn(), holidays:vi.fn(), save:vi.fn(),source:"firebase-storage"}));
vi.mock("@/lib/server/admin-auth",async original=>({...await original<typeof import("@/lib/server/admin-auth")>(),requireAdmin:m.auth}));
vi.mock("@/app/api/bus/shuttle/route",()=>({GET:m.receiver}));
vi.mock("@/lib/server/shuttle-pilot-store",()=>({savePilotSample:m.save}));
vi.mock("@/lib/server/shuttle-service-data",()=>({loadShuttleServiceData:async()=>({
  buses,specialPeriods:await m.calendar(),holidays:await m.holidays(),source:m.source,version:"test",nowISO:new Date().toISOString(),
})}));
const req = new Request("https://example.invalid/campus/bus-info/preview/locations",{method:"POST"});
const date = (day:string,time="12:00")=>new Date(`${day}T${time}:00+09:00`);
const weekday = date("2026-11-03");
const payload = () => ({success:true,stale:false,sourceStatus:"fresh",timestamp:new Date().toISOString(),data:[
  {id:"test-vehicle",name:"test-name",routeid:2,status:1,lat:37.62,lon:127.08}]});
const holiday = () => ({schemaVersion:1,sourceUrl:"",years:[2026],holidays:[],lastSuccessAt:new Date().toISOString()});
beforeEach(async()=>{
  vi.resetModules();({GET,POST}=await import("./route"));
  m.source="firebase-storage";
  vi.useFakeTimers({toFake:["Date"]}); vi.setSystemTime(weekday);
  vi.stubEnv("VERCEL_ENV","production"); vi.stubEnv("RATE_LIMIT_SECRET","test-value-not-a-secret");
  m.auth.mockResolvedValue({uid:"admin"}); m.calendar.mockResolvedValue(periods as ShuttleSpecialPeriods);
  m.holidays.mockImplementation(holiday); m.receiver.mockImplementation(()=>Response.json(payload()));
  m.save.mockImplementation(async(_rows,_receipt,writeBlock)=>writeBlock()??"saved");
});

it.each(["imported-snapshot","bundled-fallback","unavailable"])("keeps reference-only %s timetables from receiving or storing vehicle observations",async source=>{
  m.source=source;
  expect((await(await GET()).json()).collection).toBe("closed");
  expect(m.receiver).not.toHaveBeenCalled();
  expect(m.save).not.toHaveBeenCalled();
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();vi.resetAllMocks();});
it.each([["2026-10-31","00:00"],["2026-11-01","23:59"]])("does not access even the calendar, receiver or store on KST weekend %s %s",async(day,time)=>{
  vi.setSystemTime(date(day,time));
  expect((await (await GET()).json()).collection).toBe("closed");
  expect((await (await POST(req)).json()).collection).toBe("closed");
  for(const fn of [m.auth,m.calendar,m.receiver,m.save]) expect(fn).not.toHaveBeenCalled();
});
it.each(["holiday","uncertain","explicitClosure","outside","gap","weekendException"])("fails closed for %s",async mode=>{
  if(mode==="holiday") m.holidays.mockReturnValue({...holiday(),holidays:[{date:"2026-11-03",names:["test"]}]});
  if(mode==="uncertain") m.holidays.mockReturnValue({...holiday(),stale:true});
  if(mode==="explicitClosure") m.calendar.mockResolvedValue({...periods,closedDates:[{date:"2026-11-03"}]});
  if(mode==="outside") vi.setSystemTime(date("2026-11-03","06:30"));
  if(mode==="gap") vi.setSystemTime(date("2026-11-03","23:50"));
  if(mode==="weekendException"){vi.setSystemTime(date("2026-10-31"));m.calendar.mockResolvedValue({...periods,serviceExceptions:[{date:"2026-10-31",routeId:"shuttle-1",times:["12:00"]}]});}
  expect((await (await POST(req)).json()).collection).toBe("closed");
  expect(m.receiver).not.toHaveBeenCalled(); expect(m.save).not.toHaveBeenCalled();
});
it("automatically saves trusted refreshes while retaining admin authorization for field writes",async()=>{
  expect((await (await GET()).json()).collection).toBe("saved");expect(m.save).toHaveBeenCalledOnce();
  const row=m.save.mock.calls[0][0][0];m.save.mockClear();
  m.auth.mockRejectedValueOnce(new AdminAuthError("denied",403));
  expect((await POST(req)).status).toBe(403); expect(m.save).not.toHaveBeenCalled();
  const saved=await (await POST(req)).json();expect(saved).toMatchObject({collection:"saved",vehicles:1});
  expect(m.save).not.toHaveBeenCalled();expect(row.measuredAt).toBe(weekday.getTime());expect(row.measurementSource).toBe("receiver");
  expect(JSON.stringify(row)).not.toContain("test-vehicle");expect(JSON.stringify(saved)).not.toContain("vehicleKey");
  vi.setSystemTime(+weekday+5000);m.save.mockResolvedValueOnce("duplicate");expect((await (await POST(req)).json()).collection).toBe("duplicate");
});
it.each(["closed","delayed"])("removes positions when storage blocks the frame as %s",async state=>{
  m.save.mockResolvedValueOnce(state);
  expect(await(await GET()).json()).toMatchObject({collection:state,data:[],stale:state==="delayed"});
});
it("withdraws positions that expire while the commit completes",async()=>{
  m.save.mockImplementationOnce(async()=>{vi.setSystemTime(+weekday+90_000);return "saved";});
  expect(await(await GET()).json()).toMatchObject({collection:"delayed",data:[],stale:true});
});
it("rejects stale/off-hours/local observations and clears ETA state on a fresh empty frame",async()=>{
  m.receiver.mockImplementationOnce(()=>Response.json({...payload(),stale:true}));
  expect((await (await POST(req)).json()).collection).toBe("delayed");
  m.receiver.mockImplementationOnce(()=>Response.json({...payload(),data:[]}));
  expect((await (await POST(req)).json()).collection).toBe("empty");
  m.receiver.mockImplementationOnce(()=>Response.json({...payload(),data:[{...payload().data[0],routeid:4}]}));
  expect((await (await POST(req)).json()).collection).toBe("empty");
  expect(m.save.mock.calls.every(call=>call[0].length===0)).toBe(true);m.save.mockClear();
  vi.stubEnv("VERCEL_ENV","preview");expect((await (await POST(req)).json()).collection).toBe("local");
  vi.stubEnv("VERCEL_ENV","production");m.receiver.mockImplementationOnce(()=>{const p=payload();vi.setSystemTime(date("2026-11-07"));return Response.json(p);});
  expect((await (await POST(req)).json()).collection).not.toBe("saved");expect(m.save).not.toHaveBeenCalled();
});

it("keeps collecting through a headway gap and the last trip",async()=>{
  for(const clock of ["10:25","12:20"]){
    vi.setSystemTime(date("2026-11-02",clock));
    m.receiver.mockImplementation(()=>Response.json({...payload(),data:[{...payload().data[0],routeid:1}]}));
    expect((await (await POST(req)).json()).collection).toBe("saved");
  }
});
const fieldRequest=(event:unknown)=>new Request("https://example.invalid/campus/bus-info/preview/locations",{
  method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event}),
});
it("accepts a bodyless POST represented by Next as an empty readable stream",async()=>{
  const request=new Request(req.url,{method:"POST",body:new ReadableStream({start(controller){controller.close();}}),duplex:"half"} as RequestInit);
  expect((await POST(request)).status).toBe(200);
  expect(m.save).toHaveBeenCalledOnce();
});
it("does not mix conflicting receiver rows under one vehicle key",async()=>{
  m.receiver.mockImplementationOnce(()=>Response.json({...payload(),data:[payload().data[0],{...payload().data[0],status:2}]}));
  expect((await (await POST(req)).json()).collection).toBe("empty");
  expect(m.save.mock.calls[0][0]).toEqual([]);
});
it("binds a field event to the authenticated receiver vehicle and its direction",async()=>{
  const event={vehicleId:"test-vehicle",visitId:"seokgye-campus-departure",event:"departure",observedAt:weekday.getTime()};
  expect((await POST(fieldRequest(event))).status).toBe(200);
  expect(m.save.mock.calls[0][3]).toMatchObject({...event,vehicleKey:expect.any(String)});
  expect((await POST(fieldRequest({...event,vehicleId:"not-received"}))).status).toBe(409);
  expect((await POST(fieldRequest({...event,visitId:"seokgye-taereung-7"}))).status).toBe(400);
});
it.each(["future","old","coordinates","badEvent","arrayEvent"])("rejects invalid field data: %s",async mode=>{
  const event:Record<string,unknown>={vehicleId:"test-vehicle",visitId:"seokgye-campus-departure",event:"arrival",observedAt:weekday.getTime()};
  if(mode==="future")event.observedAt=weekday.getTime()+60_000;
  if(mode==="old")event.observedAt=weekday.getTime()-180_000;
  if(mode==="coordinates")event.lat=37.64;
  if(mode==="badEvent")event.event="invented";
  if(mode==="arrayEvent")event.event=["arrival"];
  expect((await POST(fieldRequest(event))).status).toBe(400);
  expect(m.receiver).not.toHaveBeenCalled();expect(m.save).not.toHaveBeenCalled();
});
