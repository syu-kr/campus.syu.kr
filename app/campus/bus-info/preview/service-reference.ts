import type { ShuttleSpecialPeriod } from "@/types";
import { applyShuttleSpecialPeriods, getShuttleScheduleType, isDateInSpecialPeriod, isReplacementSpecialPeriod } from "@/lib/shuttle-schedule";
import { koreaDateKey, shiftPreviewDate, sortedDepartures, validPreviewDate } from "./preview-timetable";
import { serviceTimetable, type ServiceRoute, type ShuttleServiceData } from "./service-data";

function periodDates(period:ShuttleSpecialPeriod) {
  if(period.applicableDates.length) return period.applicableDates.filter(validPreviewDate);
  if(!validPreviewDate(period.startDate)||!validPreviewDate(period.endDate)) return [];
  return Array.from({length:Math.max(0,Math.min(366,Math.round((Date.parse(period.endDate)-Date.parse(period.startDate))/86400000)+1))},(_,i)=>shiftPreviewDate(period.startDate,i));
}

export function referenceTables(route:ServiceRoute,now:Date,data:ShuttleServiceData) {
  const date=koreaDateKey(now),current=serviceTimetable({route,date,now,data});
  const schedule=getShuttleScheduleType(now,data.specialPeriods),vacation=schedule?.includes("Vacation")??false;
  const online=data.specialPeriods.specialPeriods.filter(p=>p.id.startsWith("online-class-week")&&
    (p.routes.includes("all")||p.routes.includes(route.scheduleId))&&
    (p.applicableDates.length?p.applicableDates.some(day=>day>=date):p.endDate>=date))
    .sort((a,b)=>a.startDate.localeCompare(b.startDate));
  const period=online.find(p=>isDateInSpecialPeriod(p,date))??online[0];
  const affects=!!period&&(period.routes.includes("all")||period.routes.includes(route.scheduleId));
  const activeOnline=!!period&&isDateInSpecialPeriod(period,date);
  const exception=current.status==="ready"&&current.activeType==="special"&&!current.period?.id.startsWith("online-class-week");
  const candidates=data.specialPeriods.specialPeriods.filter(p=>!p.id.startsWith("online-class-week")&&
    (p.routes.includes("all")||p.routes.includes(route.scheduleId)));
  const nextSpecial=exception&&!current.period?undefined:candidates.find(p=>isDateInSpecialPeriod(p,date))??candidates
    .filter(p=>isReplacementSpecialPeriod(p)&&periodDates(p).some(day=>day>=date))
    .sort((a,b)=>a.startDate.localeCompare(b.startDate))[0];
  const specialPeriods=nextSpecial?candidates.filter(p=>p===nextSpecial||!!nextSpecial.sourceUrl&&p.sourceUrl===nextSpecial.sourceUrl):[];
  const specialDates=[...new Set([...specialPeriods.flatMap(periodDates),...(exception?[date]:[])])].sort();
  const confirmed=data.source!=="unavailable"&&current.status!=="unknown"&&!!schedule;
  const currentKey=confirmed?(exception?"exception":activeOnline?"online":vacation&&route.id==="hwarangdae"?"vacation":vacation?null:"semester"):null;
  return {date,vacation,period,affects,current,currentKey,defaultKey:currentKey??"semester",defaultFriday:new Date(`${date}T12:00:00Z`).getUTCDay()===5,exception,
    specialPeriods,specialDates,defaultSpecialDate:specialDates.includes(date)?date:specialDates[0]};
}
export function referenceTimes(route:ServiceRoute,now:Date,data:ShuttleServiceData,key:string,friday:boolean,selectedDate?:string) {
  const context=referenceTables(route,now,data),bus=data.buses.find(item=>item.id===route.scheduleId);
  if(!bus||data.source==="unavailable") return [];
  if(key==="exception") {
    const date=selectedDate??context.defaultSpecialDate;
    return date&&context.specialDates.includes(date)?serviceTimetable({route,date,now,data}).scheduledTimes:[];
  }
  const type=key==="vacation"?(friday?"fridayVacation":"mondayToThursdayVacation"):(friday?"friday":"mondayToThursday");
  if(key!=="online") return sortedDepartures(bus.schedules[type]);
  const period=context.period;
  if(!period) return [];
  if(!context.affects) return sortedDepartures(bus.schedules[type]);
  const dates=periodDates(period);
  const date=dates.find(value=>{const day=new Date(`${value}T12:00:00Z`).getUTCDay();return friday?day===5:day>=1&&day<=4;});
  if(!date) return [];
  return sortedDepartures(applyShuttleSpecialPeriods({buses:[bus],dateString:date,specialPeriods:{...data.specialPeriods,specialPeriods:[period]}}).buses[0].schedules[type]);
}
