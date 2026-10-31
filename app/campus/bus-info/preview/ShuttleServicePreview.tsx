"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@/app/components/Container";
import { Button, buttonStyles } from "@/app/components/Button";
import { useLocale } from "@/app/components/LocaleProvider";
import { useStopArrivals } from "./use-stop-arrivals";
import PilotDiagnostics from "./PilotDiagnostics";
import { getKoreaDateTimeParts } from "@/lib/korea-time";
import type { BusLocation } from "@/types";
import type { LiveDataResponse } from "@/types/live-data";
import { getShuttlePreviewCopy } from "@/lib/i18n/shuttle-preview";
import { getShuttleServiceCopy } from "@/lib/i18n/shuttle-service-preview";
import { localizePath } from "@/lib/i18n/routing";
import { koreaDateKey } from "./preview-timetable";
import { receivedLocationState, serviceRoutes, serviceTimetable, type ShuttleServiceData } from "./service-data";
import { demoEventTime, demoLocations, demoProgress, demoStopArrival } from "./service-demo";
import { defaultServiceRoute } from "./service-visits";
import ShuttlePreviewMap from "./ShuttlePreviewMap";
import ShuttleServiceSchedule from "./ShuttleServiceSchedule";
import ShuttleStopTimeline from "./ShuttleStopTimeline";
import ShuttleUpcomingDepartures from "./ShuttleUpcomingDepartures";
import { stopArrivalLabels } from "./service-arrival-labels";

export default function ShuttleServicePreview({data,operatingPreview=false}:{data:ShuttleServiceData;operatingPreview?:boolean}) {
  const locale=useLocale(),copy=getShuttlePreviewCopy(locale),live=getShuttleServiceCopy(locale);
  const [clock,setClock]=useState(()=>new Date(data.nowISO));
  const [routeId,setRouteId]=useState(()=>defaultServiceRoute(new Date(data.nowISO))),[selected,setSelected]=useState<number|null>(null);
  const [elapsed,setElapsed]=useState(0),[nextAvailable,setNextAvailable]=useState(true),[delayedAt,setDelayedAt]=useState<number|null>(null),[playing,setPlaying]=useState(false);
  const delayed=delayedAt!==null;
  const [timetableOpen,setTimetableOpen]=useState(false);
  const now=operatingPreview?new Date(Date.parse(data.nowISO)+elapsed*1000):clock;
  const route=serviceRoutes.find(item=>item.id===routeId)!;
  const labels=useMemo(()=>route.stops.map((stop,index)=>`${copy[stop.name]}${stop.exit?` (${locale==="ko"?`${stop.exit}${copy.exit}`:`${copy.exit} ${stop.exit}`})`:!route.oneWay?` · ${index===0?copy.schoolDeparture:copy.schoolArrival}`:""}`),[route,copy,locale]);
  const positions=useQuery({queryKey:["shuttle-preview-locations"],queryFn:async({signal})=>{
    const response=await fetch("/campus/bus-info/preview/locations",{cache:"no-store",signal});
    if(!response.ok) throw new Error("Received positions unavailable");
    return await response.json() as LiveDataResponse<BusLocation[]> & {collection?:string};
  },enabled:!operatingPreview,staleTime:30_000,refetchInterval:operatingPreview?false:30_000,refetchIntervalInBackground:false,retry:1});
  const state=receivedLocationState(operatingPreview?undefined:positions.data,operatingPreview?false:positions.isError,now);
  const received=useMemo(()=>({locations:operatingPreview?demoLocations(route,delayedAt??elapsed,nextAvailable):state.locations.filter(bus=>bus.routeid===route.locationRouteId),stale:operatingPreview?delayed:state.stale}),[operatingPreview,route,elapsed,nextAvailable,delayed,delayedAt,state.locations,state.stale]);
  const today=serviceTimetable({route,date:koreaDateKey(now),now,data});
  const closed=!operatingPreview&&today.status==="closed"&&!received.locations.length;
  const estimates=useStopArrivals(now,!operatingPreview&&today.status==="ready");
  const arrivals=stopArrivalLabels(route,locale,operatingPreview,elapsed,nextAvailable,delayed,closed,estimates.minutes);
  function routeStatus(item:typeof route) {
    if(operatingPreview) return delayed?live.checking:demoProgress(item,elapsed,nextAvailable).length?live.running:demoStopArrival(item,elapsed,0,nextAvailable).state==="approaching"?live.scheduledStart:live.noSchedule;
    const timetable=serviceTimetable({route:item,date:koreaDateKey(now),now,data});
    const located=state.locations.some(bus=>bus.routeid===item.locationRouteId);
    if(timetable.status==="closed"&&!located) return live.dayClosed;
    if(item.id===route.id&&arrivals.some(a=>a.verified)) return live.running;
    if(located||state.stale||positions.isPending) return live.checking;
    if(timetable.status!=="ready"||!timetable.times.length) return live.checking;
    const time=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(now);
    return time<timetable.times[0]?live.scheduledStart:time<=timetable.times.at(-1)!?live.scheduledRunning:live.noSchedule;
  }
  function positionStatus() {
    if(operatingPreview) return delayed?live.lastPosition:"";
    if(positions.isError) return live.locationError;
    if(closed) return "";
    if(positions.isPending) return live.loadingLocation;
    if(!state.available) return live.expiredReceipt;
    if(state.stale) return live.delayedReceipt;
    return received.locations.length ? live.receivedCount.replace("{count}",String(received.locations.length)) : live.noVehicles;
  }
  const positionText=positionStatus();
  const timeLabel=(date:Date)=>new Intl.DateTimeFormat(locale==="ko"?"ko-KR":"en-GB",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(date);
  useEffect(()=>{if(operatingPreview) return;const timer=setInterval(()=>setClock(new Date()),1000);return()=>clearInterval(timer);},[operatingPreview]);
  useEffect(()=>{if(!operatingPreview||!playing||delayed) return;const timer=setInterval(()=>setElapsed(value=>value+5),1000);return()=>clearInterval(timer);},[operatingPreview,playing,delayed]);
  function reset() {setElapsed(0);setNextAvailable(true);setDelayedAt(null);setPlaying(false);}
  function selectRoute(id:string) {if(id===routeId) return;setRouteId(id);setSelected(null);}
  return <Container className="shuttle-preview shuttle-service-compact space-y-3 py-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-bold">{live.pageTitle}</h1><Link href={localizePath(`/campus/bus-info/preview${operatingPreview?"":"?scenario=operating"}`,locale)} className={buttonStyles("ghost")}>{operatingPreview?live.returnCurrent:live.viewOperating}</Link></div>
    {operatingPreview&&<p className="text-xs text-neutral-600" role="note"><strong>{live.demoBadge}</strong> · <time dateTime={now.toISOString()}>{koreaDateKey(now)} {timeLabel(now)}</time><br />{live.demoShort}</p>}
    <ShuttleUpcomingDepartures data={data} now={now} />
    <div className="shuttle-preview-routes grid grid-cols-3 gap-2" role="group" aria-label={copy.routeSelect}>
      {serviceRoutes.map(item=><button key={item.id} type="button" aria-label={`${copy[item.name]} ${item.oneWay?copy.campusService:copy.loop}`} aria-describedby={`route-status-${item.id}`} aria-pressed={item.id===route.id} onClick={()=>selectRoute(item.id)} className="px-2 py-2 text-sm font-semibold"><span className="shuttle-route-name"><span className="shuttle-preview-route-dot" aria-hidden="true" style={{backgroundColor:item.color}} />{copy[item.name]}<small id={`route-status-${item.id}`} className="shuttle-route-status">{routeStatus(item)}</small></span><span className="block text-xs font-normal">{item.oneWay?copy.campusService:copy.loop}</span></button>)}
    </div>
    <section aria-label={copy.routeDetails} className="shuttle-service-route grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <ShuttlePreviewMap route={route} elapsed={0} selected={selected} mode="normal" labels={labels} locale={locale} onSelect={setSelected} received={received} demonstration={operatingPreview} arrivalMessages={arrivals.map(a=>a.message)} />
        {positionText&&<div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600"><p role="status">{positionText}{!operatingPreview&&received.locations.length>0&&state.timestamp?` · ${live.receivedAt} ${timeLabel(new Date(state.timestamp))}`:""}</p>{!operatingPreview&&(positions.isError||state.stale)&&<Button variant="ghost" disabled={positions.isFetching} onClick={()=>void positions.refetch()}>{live.refresh}</Button>}</div>}
      </div>
      <ShuttleStopTimeline route={route} locale={locale} labels={labels} selected={selected} onSelect={setSelected} elapsed={elapsed} nextAvailable={nextAvailable} delayedAt={delayedAt} sample={operatingPreview} closed={closed} arrivals={arrivals} />
    </section>
    <details className="shuttle-service-disclosure border border-neutral-200" onToggle={event=>setTimetableOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">{timetableOpen?live.timetableClose:live.timetableOpen}</summary>
      <ShuttleServiceSchedule key={`${route.id}:${koreaDateKey(now)}`} route={route} now={now} data={data} />
    </details>
    {!operatingPreview&&<PilotDiagnostics key={koreaDateKey(now)} closed={[0,6].includes(getKoreaDateTimeParts(now).dayOfWeek)||closed||positions.data?.collection==="closed"} etaStatus={estimates.status}/>}
    {operatingPreview&&<details className="border-t border-neutral-200 pt-2"><summary className="cursor-pointer text-sm font-semibold">{live.demoControls}</summary>
      <p className="my-2 text-xs text-neutral-600">{koreaDateKey(now)} {timeLabel(now)} · {live.demoMapNote}</p>
      <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={delayed} onClick={()=>setPlaying(value=>!value)}>{playing?copy.pause:live.demoPlay}</Button><Button variant="secondary" onClick={()=>setElapsed(value=>value+30)}>{live.stepShort}</Button><Button variant="secondary" onClick={()=>setElapsed(value=>value+300)}>{live.demoStep}</Button><Button variant="secondary" disabled={selected===null} onClick={()=>{setPlaying(false);setElapsed(demoEventTime(route,selected??0));}}>{live.demoArrive}</Button><Button variant="secondary" disabled={selected===null} onClick={()=>{setPlaying(false);setElapsed(demoEventTime(route,selected??0,true));}}>{live.demoPass}</Button><Button variant="ghost" onClick={reset}>{copy.reset}</Button></div>
      <div className="flex flex-wrap gap-4"><label className="flex min-h-12 items-center gap-2 text-sm"><input type="checkbox" checked={nextAvailable} onChange={event=>setNextAvailable(event.target.checked)} />{live.demoNext}</label><label className="flex min-h-12 items-center gap-2 text-sm"><input type="checkbox" checked={delayed} onChange={event=>{setPlaying(false);setDelayedAt(event.target.checked?elapsed:null);}} />{live.demoDelayed}</label></div>
    </details>}
  </Container>;
}
