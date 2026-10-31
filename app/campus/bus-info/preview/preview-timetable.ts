import type { ShuttleBusSchedule, ShuttleSpecialPeriods } from "@/types";
import type { PublicHolidaySnapshot } from "@/types/public-holidays";
import { getKoreaDateTimeParts } from "@/lib/korea-time";
import { applyShuttleSpecialPeriods, getShuttleDayStatus, getShuttleExceptionBuses, getShuttleScheduleType, isDateInSpecialPeriod, timeToMinutes } from "@/lib/shuttle-schedule";
import { previewDepartures, type PreviewRoute, type PreviewScheduleType } from "./preview-data";

const previewEpoch = Date.parse("2026-10-30T12:00:00+09:00");
export const previewCalendar: ShuttleSpecialPeriods = {
  semesterPeriods: [{id:"sample-semester",name:"예시 학기",startDate:"2026-09-01",endDate:"2026-12-14",scheduleType:"semester"}],
  vacationPeriods: [{id:"sample-vacation",name:"예시 방학",startDate:"2026-12-15",endDate:"2027-01-12",scheduleType:"vacation"}],
  specialPeriods: [{id:"sample-special",name:"특별운행 예시",description:"화면 확인용 더미 시간표",startDate:"2026-10-28",endDate:"2026-11-02",type:"replace",applicableDates:[],routes:["hwarangdae","seokgye"]}],
};
// Demonstration calendar, not a collected or verified operational snapshot.
export const previewHolidays: PublicHolidaySnapshot = {
  schemaVersion:1,sourceUrl:"https://example.invalid/preview-holidays",lastSuccessAt:"2026-10-30T00:00:00Z",years:[2026,2027],
  holidays:[{date:"2026-10-09",names:["한글날 · 예시"]},{date:"2026-12-25",names:["성탄절 · 예시"]},{date:"2027-01-01",names:["신정 · 예시"]}],
};

export function previewNow(elapsed: number): Date { return new Date(previewEpoch + elapsed * 1000); }
export function koreaDateKey(date: Date): string {
  const {year,month,date:day}=getKoreaDateTimeParts(date);
  return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}
export function validPreviewDate(value: string): boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed=new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===value;
}
export function shiftPreviewDate(value: string, days: number): string {
  return new Date(Date.parse(`${value}T00:00:00Z`)+days*86400000).toISOString().slice(0,10);
}
export function sortedDepartures(times: string[]): string[] {
  return [...new Set(times.filter(time=>timeToMinutes(time)!==null).map(time=>{
    const minutes=timeToMinutes(time)!;
    return `${String(Math.floor(minutes/60)).padStart(2,"0")}:${String(minutes%60).padStart(2,"0")}`;
  }))].sort();
}
export function groupDepartures(times: string[]) {
  const hours=new Map<string,string[]>();
  for(const time of sortedDepartures(times)) {
    const hour=time.slice(0,2);
    hours.set(hour,[...(hours.get(hour)??[]),time]);
  }
  return [...hours].map(([hour,times])=>({hour,times}));
}
export function upcomingDepartures(times: string[], date: string, now: Date) {
  const sorted=sortedDepartures(times);
  return sorted.map(time=>({time,seconds:(Date.parse(`${date}T${time}:00+09:00`)-now.getTime())/1000,last:time===sorted.at(-1)}))
    .filter(item=>item.seconds>=0).slice(0,3);
}

type TimetableStatus = "ready" | "closed" | "unknown" | "unavailable" | "no-special";
export function previewTimetable({route,date,now,specialEnabled=true,view="auto",calendar=previewCalendar,holidays=previewHolidays}: {
  route: PreviewRoute; date: string; now: Date; specialEnabled?: boolean; view?: "auto" | PreviewScheduleType;
  calendar?: ShuttleSpecialPeriods; holidays?: PublicHolidaySnapshot;
}) {
  const periods=specialEnabled?calendar.specialPeriods:[];
  const scopedPeriods=periods.filter(period=>period.routes.includes("all")||period.routes.includes(route.id));
  const applicable=scopedPeriods.filter(period=>isDateInSpecialPeriod(period,date));
  const effectiveCalendar={...calendar,specialPeriods:scopedPeriods,serviceExceptions:calendar.serviceExceptions?.filter(item=>item.routeId===route.id)};
  const day=getShuttleDayStatus({dateString:date,specialPeriods:effectiveCalendar,holidays,now});
  const dateAtNoon=validPreviewDate(date)?new Date(`${date}T12:00:00+09:00`):null;
  const scheduleType=dateAtNoon?getShuttleScheduleType(dateAtNoon,effectiveCalendar):null;
  const activeType: PreviewScheduleType=applicable.length||day.operationStatus==="exception"?"special":"regular";
  const type=view==="auto"?activeType:view;
  let status:TimetableStatus=day.operationStatus==="closed"?"closed":day.operationStatus==="unconfirmed"?"unknown":!scheduleType&&day.operationStatus!=="exception"?"unavailable":"ready";
  const reference=type!==activeType;
  if(status==="ready"&&type==="special"&&!applicable.length&&day.operationStatus!=="exception") status="no-special";
  const base:ShuttleBusSchedule={id:route.id,routeName:route.id,startLocation:route.oneWay?"station":"campus",endLocation:route.oneWay?"campus":"station",lastUpdated:"",schedules:{
    mondayToThursday:previewDepartures(route,"regular"),friday:previewDepartures(route,"regular",true),
    mondayToThursdayVacation:["12:00","13:00","14:00"],fridayVacation:["12:00","13:00"],
  }};
  const withTimes:ShuttleSpecialPeriods={...effectiveCalendar,specialPeriods:scopedPeriods.map(period=>({...period,replacementSchedules:{[route.id]:{
    mondayToThursday:previewDepartures(route,"special"),friday:previewDepartures(route,"special",true),
    mondayToThursdayVacation:["12:00","13:15"],fridayVacation:["12:00"],
  }}}))};
  const exceptions=day.serviceExceptions.filter(item=>item.routeId===route.id);
  const buses=type==="regular"?[base]:exceptions.length?getShuttleExceptionBuses([base],exceptions):applyShuttleSpecialPeriods({buses:[base],dateString:date,specialPeriods:withTimes}).buses;
  const times=status==="ready"?sortedDepartures(buses[0]?.schedules[scheduleType??"mondayToThursday"]??[]):[];
  return {status,type,activeType,reference,scheduleType,times,period:applicable[0]??null};
}
