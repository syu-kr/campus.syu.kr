import { describe, expect, it } from "vitest";
import buses from "@/public/data/shuttle-bus-schedule.json";
import type { BusLocation } from "@/types";
import type { LiveDataResponse } from "@/types/live-data";
import { receivedLocationState, serviceRoutes, serviceTimetable } from "./service-data";
import { testServiceData } from "./service-test-data";
const [hwarangdae,seokgye,byeollae]=serviceRoutes;
const query=(date:string,route=seokgye,view:"auto"|"regular"|"special"="auto",data=testServiceData)=>serviceTimetable({route,date,view,data,now:new Date(data.nowISO)});

describe("published shuttle data",()=>{
  it("maps every displayed route to actual schedule and position IDs, without sample paths",()=>{
    expect(serviceRoutes.map(route=>route.scheduleId)).toEqual(buses.map(bus=>bus.id));
    expect(serviceRoutes.map(route=>route.locationRouteId)).toEqual([1,2,3]);
    expect(serviceRoutes.every(route=>route.legs.length===0)).toBe(true);
    expect(byeollae.stops[1].exit).toBe(2);
    expect(seokgye.stops.map(stop=>stop.exit??null)).toEqual([null,2,6,4,7,null]);
  });
  it("uses the published special Hwarangdae times, not dummy intervals",()=>{
    const result=query("2026-11-02",hwarangdae);
    expect(result).toMatchObject({activeType:"special",status:"ready"});
    expect(result.times).toHaveLength(16);
    expect(result.times.slice(0,3)).toEqual(["08:10","08:20","08:30"]);
    expect(result.times.at(-1)).toBe("12:00");
  });
  it("keeps Friday and weekday special Seokgye closing times separate",()=>{
    expect(query("2026-10-30").times).toEqual(["12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30"]);
    expect(query("2026-11-02").times.at(-1)).toBe("17:30");
    expect(query("2026-11-02",seokgye,"regular")).toMatchObject({reference:true,activeType:"special"});
    expect(query("2026-11-02",seokgye,"regular").times.at(-1)).toBe("18:15");
  });
  it("keeps Byeollae unchanged and excludes closed special-period dates",()=>{
    expect(query("2026-11-02",byeollae)).toMatchObject({activeType:"regular",status:"ready"});
    expect(query("2026-11-02",byeollae).times[0]).toBe("07:55");
    for(const date of ["2026-10-31","2026-11-01"]) expect(query(date)).toMatchObject({status:"closed",times:[]});
    expect(query("2026-11-02",byeollae,"special").status).toBe("no-special");
  });
  it("does not turn missing vacation/holiday data into regular service",()=>{
    expect(query("2026-06-19").times).toEqual([]);
    expect(query("2027-01-04").times).toEqual([]);
    expect(query("2027-01-04",hwarangdae).times).toContain("08:30");
    expect(query("2027-01-14").status).toBe("unavailable");
    expect(query("2026-11-02",seokgye,"auto",{...testServiceData,holidays:{...testServiceData.holidays,stale:true}})).toMatchObject({status:"unknown",times:[]});
    expect(query("2026-11-02",seokgye,"auto",{...testServiceData,buses:[]})).toMatchObject({status:"unavailable",times:[]});
  });
  it("does not mutate source records while browsing references",()=>{
    const before=JSON.stringify(testServiceData);
    query("2026-11-02");query("2026-11-02",seokgye,"regular");query("2026-10-31");
    expect(JSON.stringify(testServiceData)).toBe(before);
  });
});

describe("received positions, not GPS measurement timestamps",()=>{
  const position:BusLocation={id:"test-bus",name:"test",lat:"37.62",lon:"127.08",status:1,routeid:2};
  const response:LiveDataResponse<BusLocation[]>={success:true,data:[position],timestamp:testServiceData.nowISO,source:"shuttle",stale:false,sourceStatus:"fresh"};
  it("keeps receipt metadata and received positions without manufacturing GPS time or ETA",()=>{
    expect(receivedLocationState(response,false,new Date(testServiceData.nowISO))).toEqual({available:true,locations:[position],timestamp:response.timestamp,stale:false});
    expect(receivedLocationState({...response,data:[]},false,new Date(testServiceData.nowISO)).locations).toEqual([]);
    expect(receivedLocationState(response,true,new Date(testServiceData.nowISO)).stale).toBe(true);
  });
  it("marks ageing receipts and removes expired, invalid or far-future positions",()=>{
    const now=Date.parse(testServiceData.nowISO);
    expect(receivedLocationState(response,false,new Date(now+120001)).stale).toBe(true);
    for(const date of [new Date(now+600001),new Date(now-300001)]) expect(receivedLocationState(response,false,date).locations).toEqual([]);
    expect(receivedLocationState({...response,timestamp:"invalid"},false,new Date(now)).timestamp).toBeNull();
  });
});
