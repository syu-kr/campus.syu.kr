"use client";
import { useState } from "react";
import { Badge } from "@/app/components/Badge";
import { SourceAttribution } from "@/app/components/SourceAttribution";
import { useLocale } from "@/app/components/LocaleProvider";
import { getShuttlePreviewCopy } from "@/lib/i18n/shuttle-preview";
import { getShuttleServiceCopy } from "@/lib/i18n/shuttle-service-preview";
import { formatShuttleAdditionalService } from "@/lib/shuttle-schedule";
import { schoolBusSource, type ServiceRoute, type ShuttleServiceData } from "./service-data";
import { referenceTables, referenceTimes } from "./service-reference";
import { winterDepartures, winterVacation } from "./published-vacation";

export default function ShuttleServiceSchedule({route,now,data}:{route:ServiceRoute;now:Date;data:ShuttleServiceData}) {
  const locale=useLocale(),copy=getShuttlePreviewCopy(locale),live=getShuttleServiceCopy(locale);
  const context=referenceTables(route,now,data);
  const [choice,setChoice]=useState<{key:string;friday:boolean}|null>(null);
  const key=choice?.key??context.defaultKey,friday=choice?.friday??context.defaultFriday;
  const categories=[{key:"semester",label:live.semester},{key:"vacation",label:live.vacation},{key:"online",label:live.online},...(context.exception?[{key:"exception",label:live.specialName}]:[])];
  const period=key==="online"?context.period:key==="exception"?context.current.period:undefined;
  const vacations=[...(data.specialPeriods.vacationPeriods??[])].sort((a,b)=>a.startDate.localeCompare(b.startDate));
  const vacation=vacations.find(p=>p.endDate>=context.date)??vacations.at(-1);
  const times=referenceTimes(route,now,data,key,friday);
  const publishedWinter=key==="vacation" && vacation?.startDate===winterVacation.startDate
    && vacation.endDate===winterVacation.endDate && (route.id==="hwarangdae" || !times.length);
  const winter=friday?winterDepartures.friday:winterDepartures.weekdays;
  const title=categories.find(item=>item.key===key)!.label;
  const groups=publishedWinter
    ? [{label:live.stationDeparts,times:winter.station},{label:copy.schoolDeparture,times:winter.campus}]
    : [{label:title,times}];
  const applied=context.current.status==="ready"&&key===context.currentKey&&friday===context.defaultFriday;
  return <section id="preview-timetable" tabIndex={-1} aria-label={copy.departureTimetable} className="shuttle-timetable p-4 space-y-3">
    <h2 className="text-base font-bold">{publishedWinter?live.vacationRoute:route.oneWay?`${copy.hwarangdae} → ${copy.school}`:`${copy.school} → ${copy[route.name]} → ${copy.school}`}</h2>
    <div className="shuttle-table-categories" role="group" aria-label={live.tableCategory}>
      {categories.map(item=><button key={item.key} type="button" aria-label={`${item.label}${context.currentKey===item.key?` ${live.current}`:""}`} aria-pressed={key===item.key} onClick={()=>setChoice({key:item.key,friday})}>{item.label}{context.currentKey===item.key&&<small data-current-table={item.key}>{live.current}</small>}</button>)}
    </div>
    {key!=="exception"&&<div className="m3-segmented" role="group" aria-label={live.weekdayTable} data-selected-index={friday?1:0}>
      {[false,true].map(value=><button key={String(value)} type="button" aria-pressed={friday===value} onClick={()=>setChoice({key,friday:value})}>{value?live.friday:live.weekdays}</button>)}
    </div>}
    <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{title}</h3><Badge color="blue">{applied?live.appliedToday:copy.referenceTable}</Badge>{context.current.status==="closed"&&<span className="text-xs">{live.dayClosed}</span>}</div>
    {period&&<p className="text-xs text-neutral-600">{period.startDate} ~ {period.endDate}{!context.affects?` · ${live.sameSemester}`:""}</p>}
    {key==="vacation"&&vacation&&<p className="text-xs text-neutral-600">{vacation.startDate} ~ {vacation.endDate}</p>}
    <p className="text-xs text-neutral-600">{live.departureTableNote}</p>
    {groups.map(group=>group.times.length?<div key={group.label}>
      {publishedWinter&&<h4 className="text-sm font-semibold">{group.label}</h4>}
      <ul role="list" className="shuttle-timetable-grid" aria-label={group.label}>
        {group.times.map(time=><li key={time}><time>{time}</time>{time===group.times.at(-1)&&<small>{copy.lastDeparture}</small>}</li>)}
      </ul>
    </div>:<p key={group.label} className="text-sm text-neutral-600">{data.source==="unavailable"?live.sourceUnavailable:key==="vacation"?live.noVacation:key==="online"?live.noOnline:copy.unavailableDay}</p>)}
    {(period?.additionalServices??[]).filter(item=>item.destination===route.id).map((item,index)=>{const entry=formatShuttleAdditionalService(item,locale);return <p key={index} className="text-sm">{live.extraService} · {entry.value}</p>;})}
    <SourceAttribution sources={[{name:live.sourceSchool,url:schoolBusSource},...(period?.sourceUrl?[{name:live.sourceSpecial,url:period.sourceUrl}]:[])]} />
  </section>;
}
