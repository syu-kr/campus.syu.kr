import provenance from "./data/provenance.json";
import type { ShuttleServiceData } from "./service-data";
import { sortedDepartures } from "./preview-timetable";

// shortcut: Corrections apply only to the inspected revision; remove after canonical data is fixed.
export function applyConfirmedGuideCorrections(data:ShuttleServiceData):ShuttleServiceData {
  if(data.version!==provenance.scheduleVersion) return data;
  const buses=data.buses.map(bus=>bus.id==="shuttle-2"?{...bus,schedules:{...bus.schedules,friday:sortedDepartures([...bus.schedules.friday,"08:30"])}}:bus);
  const dates=["2026-12-08","2026-12-09","2026-12-10","2026-12-14"];
  const alreadyPresent=data.specialPeriods.specialPeriods.some(period=>period.routes.includes("shuttle-1")&&dates.every(date=>period.applicableDates.includes(date))&&period.addedTimes?.includes("19:00"));
  const specialPeriods=alreadyPresent?data.specialPeriods:{...data.specialPeriods,specialPeriods:[...data.specialPeriods.specialPeriods,{
    id:"verified-final-fall-2026",name:"기말고사 연장 운행",description:"학교 스쿨버스 안내의 2학기 기말고사 연장 운행. 2026-10-31 대조.",
    startDate:dates[0],endDate:dates.at(-1)!,type:"add" as const,addedTimes:["18:40","19:00"],applicableDates:dates,routes:["shuttle-1"],sourceUrl:provenance.officialGuide,
  }]};
  return {...data,buses,specialPeriods,guideCorrections:true};
}
