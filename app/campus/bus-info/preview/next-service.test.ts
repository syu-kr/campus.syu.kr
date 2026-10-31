import { expect, it } from "vitest";
import { nextScheduledService, serviceRoutes } from "./service-data";
import { testServiceData } from "./service-test-data";
const [hwarangdae,seokgye,byeollae]=serviceRoutes;
it("finds the actual next route departure after the weekend",()=>{
  const now=new Date(testServiceData.nowISO);
  expect(nextScheduledService({route:hwarangdae,now,data:testServiceData})).toMatchObject({date:"2026-11-02",time:"08:10"});
  expect(nextScheduledService({route:seokgye,now,data:testServiceData})).toMatchObject({date:"2026-11-02",time:"12:00"});
  expect(nextScheduledService({route:byeollae,now,data:testServiceData})).toMatchObject({date:"2026-11-02",time:"07:55"});
});
it("includes the exact last departure and moves to the next operating date immediately after it",()=>{
  const now=new Date("2026-10-30T15:30:00+09:00");
  expect(nextScheduledService({route:seokgye,now,data:testServiceData})).toMatchObject({date:"2026-10-30",time:"15:30",seconds:0});
  expect(nextScheduledService({route:seokgye,now:new Date(now.getTime()+1),data:testServiceData})).toMatchObject({date:"2026-11-02",time:"12:00"});
});
it("does not announce a next service through missing or stale calendar coverage",()=>{
  const now=new Date(testServiceData.nowISO);
  expect(nextScheduledService({route:hwarangdae,now,data:{...testServiceData,holidays:{...testServiceData.holidays,stale:true}}})).toBeNull();
  expect(nextScheduledService({route:hwarangdae,now,data:{...testServiceData,buses:[]}})).toBeNull();
});
it("uses Korean midnight and verified route-specific weekend exceptions",()=>{
  expect(nextScheduledService({route:hwarangdae,now:new Date("2026-11-01T15:00:00Z"),data:testServiceData})).toMatchObject({date:"2026-11-02",time:"08:10"});
  const data={...testServiceData,specialPeriods:{...testServiceData.specialPeriods,serviceExceptions:[{date:"2026-10-31",routeId:"shuttle-0",times:["10:30"],sourceUrl:"https://www.syu.ac.kr/test-fixture",verifiedAt:"2026-10-30T00:00:00Z"}]}};
  expect(nextScheduledService({route:hwarangdae,now:new Date(testServiceData.nowISO),data})).toMatchObject({date:"2026-10-31",time:"10:30"});
  expect(nextScheduledService({route:seokgye,now:new Date(testServiceData.nowISO),data})).toMatchObject({date:"2026-11-02",time:"12:00"});
});
it("stops after a bounded search and leaves source records untouched",()=>{
  const before=JSON.stringify(testServiceData);
  const data={...testServiceData,buses:testServiceData.buses.map(bus=>({...bus,schedules:{mondayToThursday:[],friday:[],mondayToThursdayVacation:[],fridayVacation:[]}})),specialPeriods:{...testServiceData.specialPeriods,specialPeriods:[]}};
  expect(nextScheduledService({route:hwarangdae,now:new Date(testServiceData.nowISO),data})).toBeNull();
  expect(JSON.stringify(testServiceData)).toBe(before);
});
