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
import { demoDepartures, demoEventTime, demoLocations, demoProgress } from "./service-demo";
import { defaultServiceRoute, receivedProgress } from "./service-visits";
import ShuttlePreviewMap from "./ShuttlePreviewMap";
import ShuttleServiceSchedule from "./ShuttleServiceSchedule";
import ShuttleStopTimeline from "./ShuttleStopTimeline";
import ShuttleUpcomingDepartures from "./ShuttleUpcomingDepartures";
import { stopArrivalLabels } from "./service-arrival-labels";
import { shuttleRefreshDelay } from "@/lib/shuttle-polling";
import { pilotRoutes } from "@/lib/shuttle-service-window";

export default function ShuttleServicePreview({data,operatingPreview:requestedOperatingPreview=false,surface="preview"}:{data:ShuttleServiceData;operatingPreview?:boolean;surface?:"preview"|"production"}) {
  const operatingPreview=surface==="preview"&&requestedOperatingPreview;
  const locale=useLocale(),copy=getShuttlePreviewCopy(locale),live=getShuttleServiceCopy(locale);
  const [clock,setClock]=useState(()=>new Date(data.nowISO));
  const [routeId,setRouteId]=useState(()=>defaultServiceRoute(new Date(data.nowISO))),[selected,setSelected]=useState<number|null>(null);
  const [elapsed,setElapsed]=useState(0),[nextAvailable,setNextAvailable]=useState(true),[delayedAt,setDelayedAt]=useState<number|null>(null),[playing,setPlaying]=useState(false);
  const delayed=delayedAt!==null;
  const [mapOpen,setMapOpen]=useState(false);
  const apiBase=surface==="production"?"/api/bus/shuttle":"/campus/bus-info/preview";
  const etaEndpoint=`${apiBase}/eta` as "/api/bus/shuttle/eta"|"/campus/bus-info/preview/eta";
  const now=operatingPreview?new Date(Date.parse(data.nowISO)+elapsed*1000):clock;
  const weekend=[0,6].includes(getKoreaDateTimeParts(now).dayOfWeek);
  const collectionOpen=pilotRoutes(now,data.buses,data.specialPeriods,data.holidays).length>0;
  const receive=!operatingPreview&&collectionOpen;
  const demoSchedules=useMemo(()=>Object.fromEntries(serviceRoutes.map(item=>[item.id,demoDepartures(item,data)])),[data]);
  const route=serviceRoutes.find(item=>item.id===routeId)!;
  const labels=useMemo(()=>route.stops.map((stop,index)=>`${copy[stop.name]}${stop.exit?` (${locale==="ko"?`${stop.exit}${copy.exit}`:`${copy.exit} ${stop.exit}`})`:!route.oneWay?` · ${index===0?copy.schoolDeparture:copy.schoolArrival}`:""}`),[route,copy,locale]);
  const positions=useQuery({queryKey:["shuttle-preview-locations",surface],queryFn:async({signal})=>{
    const response=await fetch(`${apiBase}/locations`,{cache:"no-store",signal});
    if(!response.ok) throw new Error("Received positions unavailable");
    return await response.json() as LiveDataResponse<BusLocation[]> & {collection?:string};
  },enabled:receive,staleTime:5_000,refetchInterval:receive?shuttleRefreshDelay:false,refetchIntervalInBackground:false,retry:1});
  const state=receivedLocationState(receive?positions.data:undefined,receive&&positions.isError,now);
  const fleet=useMemo(()=>({locations:operatingPreview?serviceRoutes.flatMap(item=>demoLocations(item,delayedAt??elapsed,nextAvailable,demoSchedules[item.id])):state.locations,stale:operatingPreview?delayed:state.stale}),[operatingPreview,elapsed,nextAvailable,delayed,delayedAt,state.locations,state.stale,demoSchedules]);
  const received=useMemo(()=>({...fleet,locations:fleet.locations.filter(bus=>bus.routeid===route.locationRouteId)}),[fleet,route]);
  const today=serviceTimetable({route,date:koreaDateKey(now),now,data});
  const closed=!operatingPreview&&(weekend||today.status==="closed"&&!received.locations.length);
  const pilotClosed=!collectionOpen||closed||positions.data?.collection==="closed";
  const estimates=useStopArrivals(now,!operatingPreview&&!weekend&&today.status==="ready",undefined,collectionOpen,etaEndpoint);
  const progress=useMemo(()=>operatingPreview?demoProgress(route,delayedAt??elapsed,nextAvailable,demoSchedules[route.id]):receivedProgress(route,received.locations,received.stale),[operatingPreview,route,received.locations,received.stale,delayedAt,elapsed,nextAvailable,demoSchedules]);
  const arrivals=stopArrivalLabels(route,locale,operatingPreview,elapsed,nextAvailable,delayed,closed,
    !received.stale&&received.locations.length?estimates.minutes:undefined,{now,departures:closed?[]:today.scheduledTimes,scheduled:estimates.scheduled,progress,demoDepartures:demoSchedules[route.id],demoEpoch:Date.parse(data.nowISO)});
  function routeStatus(item:typeof route) {
    const timetable=serviceTimetable({route:item,date:koreaDateKey(now),now,data});
    if(weekend||timetable.status==="closed"||!timetable.scheduledTimes.length) return live.noSchedule;
    const departure=(time:string)=>Date.parse(`${koreaDateKey(now)}T${time}:00+09:00`);
    if(now.getTime()<departure(timetable.scheduledTimes[0])) return live.scheduledStart;
    return now.getTime()<=departure(timetable.scheduledTimes.at(-1)!)?live.running:live.noSchedule;
  }
  function positionStatus() {
    if(operatingPreview) return delayed?live.lastPosition:"";
    if(!collectionOpen||weekend||closed||positions.isPending) return "";
    if(positions.isError) return live.locationError;
    if(!state.available) return live.expiredReceipt;
    if(state.stale) return live.delayedReceipt;
    return "";
  }
  const positionText=positionStatus();
  const timeLabel=(date:Date)=>new Intl.DateTimeFormat(locale==="ko"?"ko-KR":"en-GB",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(date);
  useEffect(()=>{if(operatingPreview) return;const timer=setInterval(()=>setClock(new Date()),1000);return()=>clearInterval(timer);},[operatingPreview]);
  useEffect(()=>{if(!operatingPreview||!playing||delayed) return;const timer=setInterval(()=>setElapsed(value=>value+5),1000);return()=>clearInterval(timer);},[operatingPreview,playing,delayed]);
  function reset() {setElapsed(0);setNextAvailable(true);setDelayedAt(null);setPlaying(false);}
  function selectRoute(id:string) {if(id===routeId) return;setRouteId(id);setSelected(null);}
  return <Container data-shuttle-surface={surface} className="shuttle-preview shuttle-service-compact space-y-3 py-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-bold">{live.pageTitle}</h1>{surface==="preview"&&<Link href={localizePath(`/campus/bus-info/preview${operatingPreview?"":"?scenario=operating"}`,locale)} className={buttonStyles("ghost")}>{operatingPreview?live.returnCurrent:live.viewOperating}</Link>}</div>
    {operatingPreview&&<p className="text-xs text-neutral-600" role="note"><strong>{live.demoBadge}</strong> · <time dateTime={now.toISOString()}>{koreaDateKey(now)} {timeLabel(now)}</time><br />{live.demoShort}</p>}
    <ShuttleUpcomingDepartures data={data} now={now} />
    <div className="shuttle-preview-routes grid grid-cols-3 gap-2" role="group" aria-label={copy.routeSelect}>
      {serviceRoutes.map(item=><button key={item.id} type="button" aria-label={`${copy[item.name]} ${item.oneWay?copy.campusService:copy.loop}`} aria-describedby={`route-status-${item.id}`} aria-pressed={item.id===route.id} onClick={()=>selectRoute(item.id)} className="px-2 py-2 text-sm font-semibold"><span className="shuttle-route-name"><span className="shuttle-route-label"><span className="shuttle-preview-route-dot" aria-hidden="true" style={{backgroundColor:item.color}} />{copy[item.name]}</span><small id={`route-status-${item.id}`} className="shuttle-route-status">{routeStatus(item)}</small></span><span className="block text-xs font-normal">{item.oneWay?copy.campusService:copy.loop}</span></button>)}
    </div>
    <div className="shuttle-service-columns">
    <ShuttleServiceSchedule key={`${route.id}:${koreaDateKey(now)}`} route={route} now={now} data={data} />
    <section aria-label={copy.routeDetails} className="shuttle-service-route space-y-3">
      <ShuttleStopTimeline route={route} locale={locale} labels={labels} selected={selected} onSelect={setSelected} delayedAt={delayedAt} sample={operatingPreview} closed={closed} arrivals={arrivals} progress={progress} onMapOpen={()=>setMapOpen(true)} />
      {positionText&&<div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600"><p role="status">{positionText}</p>{!operatingPreview&&(positions.isError||state.stale)&&<Button variant="ghost" disabled={positions.isFetching} onClick={()=>void positions.refetch()}>{live.refresh}</Button>}</div>}
      {!operatingPreview&&estimates.status==="learning"&&<p className="text-xs text-neutral-600">{live.learningNotice}</p>}
    </section>
    </div>
    {mapOpen&&<ShuttlePreviewMap received={fleet} now={now} locale={locale} data={data} etaEndpoint={etaEndpoint} onClose={()=>setMapOpen(false)} demo={operatingPreview?{elapsed:delayedAt??elapsed,nextAvailable,delayed,departuresByRoute:demoSchedules,epoch:Date.parse(data.nowISO)}:undefined}/>}
    {!operatingPreview&&surface==="preview"&&<PilotDiagnostics key={`${koreaDateKey(now)}:${pilotClosed}`} closed={pilotClosed} etaStatus={estimates.status} locations={received.locations}/>}
    {operatingPreview&&<details className="border-t border-neutral-200 pt-2"><summary className="cursor-pointer text-sm font-semibold">{live.demoControls}</summary>
      <p className="my-2 text-xs text-neutral-600">{koreaDateKey(now)} {timeLabel(now)} · {live.demoMapNote}</p>
      <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={delayed} onClick={()=>setPlaying(value=>!value)}>{playing?copy.pause:live.demoPlay}</Button><Button variant="secondary" onClick={()=>setElapsed(value=>value+30)}>{live.stepShort}</Button><Button variant="secondary" onClick={()=>setElapsed(value=>value+300)}>{live.demoStep}</Button><Button variant="secondary" disabled={selected===null} onClick={()=>{setPlaying(false);setElapsed(demoEventTime(route,selected??0,false,nextAvailable?demoSchedules[route.id]:demoSchedules[route.id].slice(0,1),elapsed));}}>{live.demoArrive}</Button><Button variant="secondary" disabled={selected===null} onClick={()=>{setPlaying(false);setElapsed(demoEventTime(route,selected??0,true,nextAvailable?demoSchedules[route.id]:demoSchedules[route.id].slice(0,1),elapsed));}}>{live.demoPass}</Button><Button variant="ghost" onClick={reset}>{copy.reset}</Button></div>
      <div className="flex flex-wrap gap-4"><label className="flex min-h-12 items-center gap-2 text-sm"><input type="checkbox" checked={nextAvailable} onChange={event=>setNextAvailable(event.target.checked)} />{live.demoNext}</label><label className="flex min-h-12 items-center gap-2 text-sm"><input type="checkbox" checked={delayed} onChange={event=>{setPlaying(false);setDelayedAt(event.target.checked?elapsed:null);}} />{live.demoDelayed}</label></div>
    </details>}
  </Container>;
}
