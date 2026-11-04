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

export default function ShuttleStopTimeline({route,locale,labels,selected,onSelect,delayedAt,arrivals,progress=[],expected=null,onMapOpen}:{
  route:ServiceRoute;locale:Locale;labels:string[];selected:number|null;onSelect:(index:number)=>void;delayedAt:number|null;sample:boolean;closed:boolean;arrivals:ReturnType<typeof stopArrivalLabels>;
  progress?:{id:string;position:number;next:number}[];
  expected?:EstimatedProgress|null;
  onMapOpen:()=>void;
}) {
  const copy=getShuttlePreviewCopy(locale),live=getShuttleServiceCopy(locale),visits=serviceVisits[route.id];
  const buses=progress;
  const clock=(at:number)=>new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(at);
  const basis=(value:string|undefined)=>value==="observed"?live.observedBasis:value==="history"?live.historyBasis:value==="route"?live.routeBasis:"";
  const toward=(index:number)=>locale==="ko"?`${copy[visits[index].toward]} ${live.toward}`:`${live.toward} ${copy[visits[index].toward]}`;
  return <section id="preview-arrivals" tabIndex={-1} aria-label={live.allStops} className="shuttle-stop-section">
    <div className="shuttle-stop-heading"><h2 className="text-sm font-bold">{live.allStops}</h2><Button variant="secondary" aria-haspopup="dialog" onClick={onMapOpen}>{live.mapOpen}</Button></div>
    <p className="shuttle-flow-direction"><DirectionArrow /> {live.travelDirection}</p>
    {expected&&<p className="shuttle-estimated-caption" data-testid="estimated-progress"><strong>{live.expectedSegment}</strong> · {live.expectedTrip.replace("{time}",clock(expected.departureAt))}<br />{labels[expected.from]} → {labels[expected.next]}</p>}
    <div className="shuttle-stop-timeline" style={{"--route-color":route.color,"--half-stop-row":`${50/visits.length}%`} as CSSProperties}>
      <div className="shuttle-stop-track" aria-hidden="true">
        {expected&&<span key={expected.key} className="shuttle-timeline-bus shuttle-estimated-bus" data-estimated-trip={expected.key} data-progress={expected.position} style={{top:`${expected.position/(visits.length-1)*100}%`}}>
          <svg width="32" height="38" viewBox="0 0 40 48" focusable="false"><image width="40" height="48" href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(vehiclePinSvg(route.color))}`} /></svg>
          <small>{live.estimatedBadge}</small>
        </span>}
        {visits.slice(1).map((visit,index)=><DirectionArrow key={visit.id} className="shuttle-track-arrow" style={{top:`${(index+.5)/(visits.length-1)*100}%`}} />)}
        {buses.map((bus,i)=><svg key={bus.id} data-timeline-vehicle={bus.id} data-progress={bus.position} className="shuttle-timeline-bus" width="32" height="38" viewBox="0 0 40 48" style={{top:`${bus.position/(visits.length-1)*100}%`,left:i>0&&Math.abs(bus.position-buses[0].position)<.45?16:0}}><image width="40" height="48" href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(vehiclePinSvg(route.color,delayedAt!==null))}`} /></svg>)}
      </div>
      <ol>{visits.map((visit,index)=>{
        const {eta,detail,following,arrivalClock,source}=arrivals[index];
        return <li key={visit.id} data-visit-id={visit.id}><button type="button" aria-pressed={selected===index} onClick={()=>onSelect(index)}>
          <span className="shuttle-stop-dot" aria-hidden="true" />
          <span className="shuttle-stop-content"><span className="shuttle-stop-name">{labels[index]}</span><span className="shuttle-stop-permission">{live[visit.role]}</span><span className="shuttle-stop-direction">{index===visits.length-1?live.terminal:toward(index)}</span></span>
          <span className="shuttle-stop-eta" data-testid={`stop-eta-${visit.id}`}><span className="shuttle-arrival-value"><span>{eta}</span>{arrivalClock&&<small className="shuttle-arrival-clock" aria-label={`${arrivalClock} ${live.arrivalAt}`} title={live.arrivalAt}>· {arrivalClock}</small>}</span>{detail&&<small>{detail}</small>}{source&&<small>{source==="observed"?live.locationReflected:live.operationEstimate}</small>}{following&&<small>{following}</small>}</span>
        </button></li>;
      })}</ol>
    </div>
    <div className="sr-only">
      {buses.map(bus=><p key={bus.id}>{delayedAt!==null?live.lastPosition:Number.isInteger(bus.position)?live.stopped:live.movingTo} · {labels[bus.next]} · {toward(Math.floor(bus.position))}</p>)}
    </div>
    {arrivals.some(row=>row.source)&&<details className="shuttle-prediction-details"><summary>{live.predictionDetails}</summary>
      {arrivals.map((row,index)=>row.source&&<p key={visits[index].id}><strong>{labels[index]}</strong> · {row.source==="observed"?live.locationReflected:live.operationEstimate}{basis(row.basis)&&` · ${basis(row.basis)}`}{row.measuredAt!==undefined&&` · ${live.lastObservation} ${clock(row.measuredAt)}`}</p>)}
    </details>}
  </section>;
}

function DirectionArrow({className,style}:{className?:string;style?:CSSProperties}) {
  return <svg className={className} style={style} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
    <path d="m3 5 5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
