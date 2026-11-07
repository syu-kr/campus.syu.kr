"use client";
import type { CSSProperties } from "react";
import { Button } from "@/app/components/Button";
import type { Locale } from "@/lib/i18n";
import { getShuttlePreviewCopy } from "@/lib/i18n/shuttle-preview";
import { getShuttleServiceCopy } from "@/lib/i18n/shuttle-service-preview";
import type { stopArrivalLabels } from "./service-arrival-labels";
import { serviceVisits } from "./service-visits";
import { vehiclePinSvg } from "./preview-vehicles";
import type { ServiceRoute } from "./service-data";
import type { EstimatedProgress } from "./service-estimated-progress";

export default function ShuttleStopTimeline({route,locale,labels,selected,onSelect,delayedAt,arrivals,progress=[],expected=[],onMapOpen}:{
  route:ServiceRoute;locale:Locale;labels:string[];selected:number|null;onSelect:(index:number)=>void;delayedAt:number|null;sample:boolean;closed:boolean;arrivals:ReturnType<typeof stopArrivalLabels>;
  progress?:{id:string;position:number;next:number}[];
  expected?:readonly EstimatedProgress[];
  onMapOpen:()=>void;
}) {
  const copy=getShuttlePreviewCopy(locale),live=getShuttleServiceCopy(locale),visits=serviceVisits[route.id];
  const buses=progress;
  const lanes:number[]=[];
  const expectedPins=[...expected].sort((a,b)=>a.position-b.position).map(trip=>{
    // At 80px per stop, 0.7 stops leaves room for the bus and its badge.
    const free=lanes.findIndex(position=>trip.position-position>=.7);
    const lane=free<0?lanes.length:free;
    lanes[lane]=trip.position;
    return {...trip,lane};
  });
  const toward=(index:number)=>locale==="ko"?`${copy[visits[index].toward]} ${live.toward}`:`${live.toward} ${copy[visits[index].toward]}`;
  return <section id="preview-arrivals" tabIndex={-1} aria-label={live.allStops} className="shuttle-stop-section">
    <div className="shuttle-stop-heading"><h2 className="text-sm font-bold">{live.allStops}</h2><Button variant="secondary" aria-haspopup="dialog" onClick={onMapOpen}>{live.mapOpen}</Button></div>
    <div className="shuttle-stop-timeline" style={{"--route-color":route.color,"--half-stop-row":`${50/visits.length}%`,"--extra-bus-space":`${Math.max(0,lanes.length-1)*36}px`} as CSSProperties}>
      <div className="shuttle-stop-track">
        {expectedPins.map(trip=><span key={trip.key} className="shuttle-timeline-bus shuttle-estimated-bus" role="img" aria-label={live.estimatedBadge} data-estimated-trip={trip.key} data-progress={trip.position} style={{top:`${trip.position/(visits.length-1)*100}%`,left:trip.lane*36}}>
          <svg width="32" height="38" viewBox="0 0 40 48" aria-hidden="true" focusable="false"><image width="40" height="48" href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(vehiclePinSvg(route.color))}`} /></svg>
          <small>{live.estimatedBadge}</small>
        </span>)}
        {visits.slice(1).map((visit,index)=><DirectionArrow key={visit.id} className="shuttle-track-arrow" style={{top:`${(index+.5)/(visits.length-1)*100}%`}} />)}
        {buses.map((bus,i)=><svg key={bus.id} aria-hidden="true" focusable="false" data-timeline-vehicle={bus.id} data-progress={bus.position} className="shuttle-timeline-bus" width="32" height="38" viewBox="0 0 40 48" style={{top:`${bus.position/(visits.length-1)*100}%`,left:i>0&&Math.abs(bus.position-buses[0].position)<.45?16:0}}><image width="40" height="48" href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(vehiclePinSvg(route.color,delayedAt!==null))}`} /></svg>)}
      </div>
      <ol>{visits.map((visit,index)=>{
        const {eta,arrivalClock,detail}=arrivals[index];
        return <li key={visit.id} data-visit-id={visit.id}><button type="button" aria-pressed={selected===index} onClick={()=>onSelect(index)}>
          <span className="shuttle-stop-dot" aria-hidden="true" />
          <span className="shuttle-stop-content"><span className="shuttle-stop-name">{labels[index]}</span><span className="shuttle-stop-permission">{live[visit.role]}</span><span className="shuttle-stop-direction">{index===visits.length-1?live.terminal:toward(index)}</span></span>
          <span className="shuttle-stop-eta" data-testid={`stop-eta-${visit.id}`}><span className="shuttle-arrival-value"><span>{eta}</span>{arrivalClock&&<small className="shuttle-arrival-clock" aria-label={`${arrivalClock} ${live.arrivalAt}`} title={live.arrivalAt}>· {arrivalClock}</small>}</span>{index===0&&detail&&<small>{detail}</small>}</span>
        </button></li>;
      })}</ol>
    </div>
    <div className="sr-only">
      {buses.map(bus=><p key={bus.id}>{delayedAt!==null?live.lastPosition:Number.isInteger(bus.position)?live.stopped:live.movingTo} · {labels[bus.next]} · {toward(Math.floor(bus.position))}</p>)}
    </div>
  </section>;
}

function DirectionArrow({className,style}:{className?:string;style?:CSSProperties}) {
  return <svg className={className} style={style} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
    <path d="m3 5 5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
