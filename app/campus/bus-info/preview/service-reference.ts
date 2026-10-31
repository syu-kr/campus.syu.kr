import { applyShuttleSpecialPeriods, getShuttleScheduleType } from "@/lib/shuttle-schedule";
import { koreaDateKey, shiftPreviewDate, sortedDepartures } from "./preview-timetable";
import { serviceTimetable, type ServiceRoute, type ShuttleServiceData } from "./service-data";

export function referenceTables(route:ServiceRoute,now:Date,data:ShuttleServiceData) {
  const date=koreaDateKey(now),current=serviceTimetable({route,date,now,data});
  const schedule=getShuttleScheduleType(now,data.specialPeriods),vacation=schedule?.includes("Vacation")??false;
  const online=data.specialPeriods.specialPeriods.filter(p=>p.id.startsWith("online-class-week"));
  const period=online.find(p=>p.startDate<=date&&date<=p.endDate)??online.filter(p=>p.startDate<=date).sort((a,b)=>a.startDate.localeCompare(b.startDate)).at(-1);
  const affects=!!period&&(period.routes.includes("all")||period.routes.includes(route.scheduleId));
  const activeOnline=affects&&period!.startDate<=date&&date<=period!.endDate&&(current.status==="closed"||current.period?.id===period!.id);
  const exception=current.status==="ready"&&current.activeType==="special"&&!current.period?.id.startsWith("online-class-week");
  const confirmed=data.source!=="unavailable"&&current.status!=="unknown"&&!!schedule;
  const currentKey=confirmed?(exception?"exception":activeOnline?"online":vacation?"vacation":"semester"):null;
  return {date,vacation,period,affects,current,currentKey,defaultKey:currentKey??"semester",defaultFriday:new Date(`${date}T12:00:00Z`).getUTCDay()===5,exception};
}
export function referenceTimes(route:ServiceRoute,now:Date,data:ShuttleServiceData,key:string,friday:boolean) {
  const context=referenceTables(route,now,data),bus=data.buses.find(item=>item.id===route.scheduleId);
  if(!bus||data.source==="unavailable") return [];
  if(key==="exception") return context.exception?context.current.times:[];
  const type=key==="vacation"?(friday?"fridayVacation":"mondayToThursdayVacation"):(friday?"friday":"mondayToThursday");
  if(key!=="online") return sortedDepartures(bus.schedules[type]);
  const period=context.period;
  if(!period) return [];
  if(!context.affects) return sortedDepartures(bus.schedules[type]);
  const dates=period.applicableDates.length?period.applicableDates:Array.from({length:Math.min(366,Math.round((Date.parse(period.endDate)-Date.parse(period.startDate))/86400000)+1)},(_,i)=>shiftPreviewDate(period.startDate,i));
  const date=dates.find(value=>{const day=new Date(`${value}T12:00:00Z`).getUTCDay();return friday?day===5:day>=1&&day<=4;});
  if(!date) return [];
  return sortedDepartures(applyShuttleSpecialPeriods({buses:[bus],dateString:date,specialPeriods:{...data.specialPeriods,specialPeriods:[period]}}).buses[0].schedules[type]);
}
