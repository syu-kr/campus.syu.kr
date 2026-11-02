import type { BusLocation, PublicHolidaySnapshot, ShuttleBusSchedule, ShuttleSpecialPeriods } from "@/types";
import type { LiveDataResponse } from "@/types/live-data";
import { applyShuttleSpecialPeriods, getShuttleDayStatus, getShuttleExceptionBuses, getShuttleScheduleType, isDateInSpecialPeriod } from "@/lib/shuttle-schedule";
import { koreaDateKey, shiftPreviewDate, sortedDepartures, upcomingDepartures, validPreviewDate } from "./preview-timetable";
import type { Point, PreviewRoute, PreviewScheduleType, StopName } from "./preview-data";
import { shuttlePlaces } from "@/lib/shuttle-visits";

export type ShuttleServiceData = {
  buses: ShuttleBusSchedule[]; specialPeriods: ShuttleSpecialPeriods; holidays: PublicHolidaySnapshot;
  nowISO: string; source: "firebase-storage" | "bundled-fallback" | "imported-snapshot" | "unavailable"; version: string;
  retrievedAt?:string; guideCorrections?:boolean;
};
type PlaceStop = { name: StopName; exit?: number; point: Point; placeId: string };
export type ServiceRoute = Omit<PreviewRoute,"stops"> & { scheduleId: string; locationRouteId: number; stops: PlaceStop[] };
export const schoolBusSource = "https://www.syu.ac.kr/school-life/school-bus/";

// Places search, 2026-10-30: registered places/exits, not field-verified boarding points.
// The official page reconfirmed Exit 2 on 2026-10-31; the older schedule JSON says Exit 3.
const {school,hwarang2,hwarang5,taereung6,taereung7,seokgye,byeollae}=shuttlePlaces;
export const serviceRoutes:ServiceRoute[]=[
  {id:"hwarangdae",scheduleId:"shuttle-0",locationRouteId:1,name:"hwarangdae",color:"#3b82f6",oneWay:true,target:1,stops:[hwarang5,school],legs:[]},
  {id:"seokgye",scheduleId:"shuttle-1",locationRouteId:2,name:"seokgye",color:"#10b981",target:3,stops:[school,hwarang2,taereung6,seokgye,taereung7,school],legs:[]},
  {id:"byeollae",scheduleId:"shuttle-2",locationRouteId:3,name:"byeollae",color:"#f59e0b",target:1,stops:[school,byeollae,school],legs:[]},
];
export const serviceOutboundRoute:ServiceRoute={...serviceRoutes[0],id:"hwarangdae-outbound",stops:[school,hwarang5]};

export function serviceTimetable({route,date,now,view="auto",data}: {
  route:PreviewRoute; date:string; now:Date; view?:"auto"|PreviewScheduleType; data:ShuttleServiceData;
}) {
  const scheduleId=serviceRoutes.find(item=>item.id===route.id)?.scheduleId;
  const bus=data.buses.find(item=>item.id===scheduleId);
  const periods=data.specialPeriods.specialPeriods.filter(period=>period.routes.includes("all")||period.routes.includes(scheduleId??""));
  const calendar={...data.specialPeriods,specialPeriods:periods,serviceExceptions:data.specialPeriods.serviceExceptions?.filter(item=>item.routeId===scheduleId)};
  const day=getShuttleDayStatus({dateString:date,specialPeriods:calendar,holidays:data.holidays,now});
  const applicable=periods.filter(period=>isDateInSpecialPeriod(period,date));
  const scheduleType=validPreviewDate(date)?getShuttleScheduleType(new Date(`${date}T12:00:00+09:00`),calendar):null;
  const activeType:PreviewScheduleType=applicable.length||day.operationStatus==="exception"?"special":"regular";
  const type=view==="auto"?activeType:view;
  let status:"ready"|"closed"|"unknown"|"unavailable"|"no-special"=
    data.source==="unavailable"||!bus?"unavailable":day.operationStatus==="closed"?"closed":day.operationStatus==="unconfirmed"?"unknown":!scheduleType&&day.operationStatus!=="exception"?"unavailable":"ready";
  if(status==="ready"&&type==="special"&&!applicable.length&&day.operationStatus!=="exception") status="no-special";
  const buses=!bus?[]:type==="regular"?[bus]:day.serviceExceptions.length?getShuttleExceptionBuses([bus],day.serviceExceptions):applyShuttleSpecialPeriods({buses:[bus],dateString:date,specialPeriods:calendar}).buses;
  const times=status==="ready"?sortedDepartures(buses[0]?.schedules[scheduleType??"mondayToThursday"]??[]):[];
  return {status,type,activeType,reference:type!==activeType,scheduleType,times,period:applicable[0]??null};
}

export function nextScheduledService({route,now,data}:{route:PreviewRoute;now:Date;data:ShuttleServiceData}) {
  const today=koreaDateKey(now);
  // shortcut: Search 14 days; extend for longer closures. Gaps cannot confirm the next service.
  for(let offset=0;offset<14;offset++) {
    const date=shiftPreviewDate(today,offset);
    const timetable=serviceTimetable({route,date,now,data});
    if(timetable.status!=="ready"&&timetable.status!=="closed") return null;
    const departure=upcomingDepartures(timetable.times,date,now)[0];
    if(departure) return {date,...departure};
  }
  return null;
}

const noLocations:BusLocation[]=[];
export function receivedLocationState(response:LiveDataResponse<BusLocation[]>|undefined,failed:boolean,now:Date) {
  const fetchedAt=response?Date.parse(response.timestamp):NaN;
  const age=now.getTime()-fetchedAt;
  const valid=!!response&&response.success&&Number.isFinite(fetchedAt)&&age>=-300_000&&age<=600_000;
  return {available:valid,locations:valid?response.data:noLocations,stale:failed||!valid||response?.stale===true||response?.sourceStatus!=="fresh"||age>120_000,
    timestamp:valid?response.timestamp:null};
}
