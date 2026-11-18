import { expect, it } from "vitest";
import { referenceTables, referenceTimes } from "./service-reference";
import { serviceRoutes } from "./service-data";
import { testServiceData } from "./service-test-data";
const [hwarangdae,seokgye,byeollae]=serviceRoutes;
const now=new Date(testServiceData.nowISO);
it("keeps upcoming applicable references on closed days without marking them current or duplicating unchanged routes",()=>{
  expect(referenceTables(seokgye,now,testServiceData).current.status).toBe("closed");
  expect(referenceTimes(seokgye,now,testServiceData,"semester",true).at(-1)).toBe("15:30");
  expect(referenceTimes(seokgye,now,testServiceData,"semester",false).at(-1)).toBe("18:15");
  expect(referenceTables(hwarangdae,now,testServiceData).period?.id).toBe("online-class-week-fall-2026");
  expect(referenceTables(hwarangdae,now,testServiceData).currentKey).toBe("semester");
  expect(referenceTables(byeollae,now,testServiceData).currentKey).toBe("semester");
  expect(referenceTables(byeollae,now,testServiceData).period).toBeUndefined();
  expect(referenceTimes(hwarangdae,now,testServiceData,"vacation",true)).toEqual(testServiceData.buses[0].schedules.fridayVacation);
  expect(referenceTimes(byeollae,now,testServiceData,"vacation",true)).toEqual([]);
});
it("preserves Friday limits and unchanged routes without mutating source data",()=>{
  const before=JSON.stringify(testServiceData);
  expect(referenceTimes(seokgye,now,testServiceData,"online",true).at(-1)).toBe("15:30");
  expect(referenceTimes(seokgye,now,testServiceData,"online",false).at(-1)).toBe("17:30");
  expect(referenceTimes(byeollae,now,testServiceData,"online",false)).toEqual([]);
  expect(JSON.stringify(testServiceData)).toBe(before);
});
it("does not certify stale dates or infer current from the next operating day",()=>{
  const data={...testServiceData,holidays:{...testServiceData.holidays,stale:true}};
  expect(referenceTables(seokgye,new Date("2026-10-30T11:50:00+09:00"),data).currentKey).toBeNull();
  expect(referenceTimes(seokgye,now,data,"semester",true).length).toBeGreaterThan(0);
  const vacation=new Date("2026-07-10T10:00:00+09:00");
  expect(referenceTables(hwarangdae,vacation,testServiceData).vacation).toBe(true);
  const upcoming=referenceTables(seokgye,new Date("2026-10-27T10:00:00+09:00"),testServiceData);
  expect(upcoming.period?.id).toBe("online-class-week-fall-2026");
  expect(upcoming.currentKey).not.toBe("online");
});
it("removes ended periods and respects explicit applicable dates and route scope",()=>{
  for(const route of serviceRoutes)expect(referenceTables(route,new Date("2026-11-04T10:00:00+09:00"),testServiceData).period).toBeUndefined();
  const period={...testServiceData.specialPeriods.specialPeriods.find(p=>p.id==="online-class-week-fall-2026")!,endDate:"2026-11-30",applicableDates:["2026-10-30"]};
  const data={...testServiceData,specialPeriods:{...testServiceData.specialPeriods,specialPeriods:[period]}};
  expect(referenceTables(seokgye,new Date("2026-11-02T10:00:00+09:00"),data).period).toBeUndefined();
});
it.each([
  ["2026-11-22T23:59:59+09:00","semester","2026-11-23"],
  ["2026-11-23T00:00:00+09:00","exception","2026-11-23"],
  ["2026-11-23T23:59:59+09:00","exception","2026-11-23"],
  ["2026-11-24T00:00:00+09:00","exception","2026-11-24"],
  ["2026-11-24T23:59:59+09:00","exception","2026-11-24"],
  ["2026-11-25T00:00:00+09:00","semester",undefined],
])("selects the applicable table at the Korea date boundary %s",(nowISO,key,date)=>{
  const data={...testServiceData,holidays:{...testServiceData.holidays,lastSuccessAt:nowISO}};
  for(const route of serviceRoutes) {
    const result=referenceTables(route,new Date(nowISO),data);
    expect(result.currentKey).toBe(key);
    expect(result.defaultSpecialDate).toBe(date);
    expect(result.specialDates).toEqual(date?["2026-11-23","2026-11-24"]:[]);
  }
});
it("keeps references from one notice together without mixing another special notice or mutating the current timetable",()=>{
  const nowISO="2026-11-24T11:00:00+09:00",now=new Date(nowISO);
  const original=testServiceData.specialPeriods.specialPeriods.find(p=>p.id==="essay-exam-2026-11-24")!;
  const other={...original,id:"other-notice",startDate:"2026-12-01",endDate:"2026-12-01",applicableDates:["2026-12-01"],sourceUrl:"https://www.syu.ac.kr/blog/another-notice/"};
  const data={...testServiceData,holidays:{...testServiceData.holidays,lastSuccessAt:nowISO},specialPeriods:{...testServiceData.specialPeriods,specialPeriods:[...testServiceData.specialPeriods.specialPeriods,other]}};
  const before=JSON.stringify(data);
  expect(referenceTables(seokgye,now,data).specialDates).toEqual(["2026-11-23","2026-11-24"]);
  expect(referenceTimes(seokgye,now,data,"exception",true,"2026-11-23")[0]).toBe("14:00");
  expect(referenceTimes(seokgye,now,data,"exception",true,"2026-11-24")[0]).toBe("12:00");
  expect(referenceTimes(seokgye,now,data,"exception",false,"2026-12-01")).toEqual([]);
  expect(referenceTimes(hwarangdae,now,data,"exception",false,"2026-11-23")).toEqual([]);
  expect(referenceTables(seokgye,now,data).current.times[0]).toBe("12:00");
  expect(JSON.stringify(data)).toBe(before);
});
