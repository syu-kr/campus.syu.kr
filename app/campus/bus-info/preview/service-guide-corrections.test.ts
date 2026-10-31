import { expect, it } from "vitest";
import { applyConfirmedGuideCorrections } from "./service-guide-corrections";
import { serviceRoutes, serviceTimetable } from "./service-data";
import { testServiceData } from "./service-test-data";
import provenance from "./data/provenance.json";
const original={...testServiceData,version:provenance.scheduleVersion};
const now=new Date(testServiceData.nowISO);
it("corrects the inspected Friday Byeollae omission without changing source records",()=>{
  const before=JSON.stringify(original);
  const data=applyConfirmedGuideCorrections(original);
  const result=serviceTimetable({route:serviceRoutes[2],date:"2026-10-30",data,now});
  expect(result.times).toContain("08:30");
  expect(result.times).toHaveLength(10);
  expect(JSON.stringify(original)).toBe(before);
  expect(applyConfirmedGuideCorrections(data)).toEqual(data);
});
it("uses the explicit fall final-exam dates and does not extend Friday",()=>{
  const data=applyConfirmedGuideCorrections(original);
  for(const date of ["2026-12-08","2026-12-09","2026-12-10","2026-12-14"]) {
    expect(serviceTimetable({route:serviceRoutes[1],date,data,now}).times.slice(-2)).toEqual(["18:40","19:00"]);
  }
  expect(serviceTimetable({route:serviceRoutes[1],date:"2026-12-11",data,now}).times.at(-1)).toBe("15:30");
});
it("does not override an uninspected newer source revision",()=>{
  const newer={...original,version:"newer-revision"};
  expect(applyConfirmedGuideCorrections(newer)).toBe(newer);
});
it("activates the published winter timetable only within its effective dates",()=>{
  const data=applyConfirmedGuideCorrections(original);
  expect(serviceTimetable({route:serviceRoutes[0],date:"2026-12-18",data,now}).scheduleType).toBe("fridayVacation");
  expect(serviceTimetable({route:serviceRoutes[0],date:"2026-12-14",data,now}).scheduleType).toBe("mondayToThursday");
  expect(["fridayVacation","mondayToThursdayVacation"]).not.toContain(serviceTimetable({route:serviceRoutes[0],date:"2027-01-13",data,now}).scheduleType);
});
