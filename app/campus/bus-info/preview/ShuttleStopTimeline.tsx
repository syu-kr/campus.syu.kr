"use client";
import type { CSSProperties } from "react";
import type { Locale } from "@/lib/i18n";
import { getShuttlePreviewCopy } from "@/lib/i18n/shuttle-preview";
import { getShuttleServiceCopy } from "@/lib/i18n/shuttle-service-preview";
import { demoProgress } from "./service-demo";
import type { stopArrivalLabels } from "./service-arrival-labels";
import { serviceVisits } from "./service-visits";
import { vehiclePinSvg } from "./preview-vehicles";
import type { ServiceRoute } from "./service-data";

export default function ShuttleStopTimeline({route,locale,labels,selected,onSelect,elapsed,nextAvailable,delayedAt,sample,closed,arrivals}:{
  route:ServiceRoute;locale:Locale;labels:string[];selected:number|null;onSelect:(index:number)=>void;elapsed:number;nextAvailable:boolean;delayedAt:number|null;sample:boolean;closed:boolean;arrivals:ReturnType<typeof stopArrivalLabels>;
}) {
  const copy=getShuttlePreviewCopy(locale),live=getShuttleServiceCopy(locale),visits=serviceVisits[route.id];
  const buses=sample?demoProgress(route,delayedAt??elapsed,nextAvailable):[];
  const toward=(index:number)=>locale==="ko"?`${copy[visits[index].toward]} ${live.toward}`:`${live.toward} ${copy[visits[index].toward]}`;
  return <section id="preview-arrivals" tabIndex={-1} aria-label={live.allStops} className="shuttle-stop-section">
    <h2 className="text-sm font-bold">{live.allStops}</h2>
    {!sample&&!closed&&!arrivals.some(a=>a.verified)&&<p className="mt-1 text-xs text-neutral-600">{live.arrivalUnavailable}</p>}
    <div className="shuttle-stop-timeline" style={{"--route-color":route.color,"--half-stop-row":`${50/visits.length}%`} as CSSProperties}>
      <div className="shuttle-stop-track" aria-hidden="true">
        {buses.map((bus,i)=><svg key={bus.id} data-timeline-vehicle={bus.id} data-progress={bus.position} className="shuttle-timeline-bus" width="32" height="38" viewBox="0 0 40 48" style={{top:`${bus.position/(visits.length-1)*100}%`,left:i>0&&Math.abs(bus.position-buses[0].position)<.45?16:0}}><image width="40" height="48" href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(vehiclePinSvg(route.color,delayedAt!==null))}`} /></svg>)}
      </div>
      <ol>{visits.map((visit,index)=>{
        const {eta,detail,following}=arrivals[index];
        return <li key={visit.id} data-visit-id={visit.id}><button type="button" aria-pressed={selected===index} onClick={()=>onSelect(index)}>
          <span className="shuttle-stop-dot" aria-hidden="true" />
          <span className="shuttle-stop-content"><span className="shuttle-stop-name">{labels[index]}</span><span className="shuttle-stop-permission">{live[visit.role]}</span><span className="shuttle-stop-direction">{index===visits.length-1?live.terminal:toward(index)}</span></span>
          <span className="shuttle-stop-eta" data-testid={`stop-eta-${visit.id}`}>{eta}{detail&&<small>{detail}</small>}{following&&<small>{following}</small>}</span>
        </button></li>;
      })}</ol>
    </div>
    <div className="sr-only">
      {buses.map(bus=><p key={bus.id}>{delayedAt!==null?live.lastPosition:Number.isInteger(bus.position)?live.stopped:live.movingTo} · {labels[bus.next]} · {toward(Math.floor(bus.position))}</p>)}
      {!sample&&!closed&&!arrivals.some(a=>a.verified)&&<p>{live.directionPending}</p>}
    </div>
  </section>;
}
