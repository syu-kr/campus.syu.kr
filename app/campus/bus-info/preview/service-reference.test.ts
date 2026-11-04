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
