"use client";

import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadKakaoMapsSdk } from "@/lib/kakao-maps-loader";
import { getShuttlePreviewCopy } from "@/lib/i18n/shuttle-preview";
import { getShuttleServiceCopy } from "@/lib/i18n/shuttle-service-preview";
import type { BusLocation } from "@/types";
import type { Locale } from "@/lib/i18n";
import { positionOnRoute, previewRuns, runningVehicleTrips, type Point, type PreviewRoute, type PreviewMode, type PreviewRun } from "./preview-data";
import { vehiclePinSvg } from "./preview-vehicles";
import { serviceRoadPaths } from "./service-visits";

type Marker = KakaoMarker & { setPosition: (point: KakaoLatLng) => void; setImage: (image: KakaoMarkerImage) => void; setZIndex: (value: number) => void };
type Maps = KakaoMapsNamespace & {
  Polyline: new (options: { path: KakaoLatLng[]; strokeWeight: number; strokeColor: string; strokeOpacity: number; strokeStyle: string; endArrow: boolean }) => { setMap: (map: KakaoMap | null) => void };
};

type MapProps = {
  route: PreviewRoute; elapsed: number; selected: number|null; mode: PreviewMode;
  labels: string[]; locale: Locale; indices?: number[]; onSelect?: (index: number) => void; runs?: PreviewRun[];
  received?:{locations:BusLocation[];stale:boolean};
  demonstration?:boolean;
  arrivalMessages?:string[];
};

export default function ShuttlePreviewMap(props: MapProps) {
  const {locale,route,labels,selected,onSelect,arrivalMessages}=props;
  const copy=getShuttlePreviewCopy(locale),live=getShuttleServiceCopy(locale);
  const dialog=useRef<HTMLDialogElement>(null);
  const [expanded,setExpanded]=useState(false);
  const title=route.id==="hwarangdae-outbound"?live.outboundRegion:copy[route.name];
  const samePlace=selected===null?[]:route.stops.flatMap((stop,i)=>stop.point.join()===route.stops[selected].point.join()?[i]:[]);
  const map=<>
    <MapCanvas {...props} expanded={expanded} />
    {arrivalMessages&&samePlace.length>0&&<div className="shuttle-map-arrival" role="status">
      {samePlace.map(i=><p key={i}><strong>{labels[i]}</strong><span>{arrivalMessages[i]}</span></p>)}
    </div>}
  </>;
  const credit=props.received?<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-xs underline">© OpenStreetMap</a>:<span className="text-xs">{copy.samplePath}</span>;
  return <div className="shuttle-map">
    {expanded?<div className="h-48 sm:h-80" aria-hidden="true" />:map}
    <div className="shuttle-map-footer">{credit}<button type="button" aria-haspopup="dialog" onClick={()=>{
      dialog.current?.showModal();
      setExpanded(true);
    }}>{live.fullMap}</button></div>
    <dialog ref={dialog} aria-label={`${title} · ${copy.routeMap}`} className="shuttle-full-map" onClose={()=>setExpanded(false)}>
      <header><strong>{title}</strong><button type="button" onClick={()=>dialog.current?.close()}>{live.shrinkMap}</button></header>
      {expanded&&<>{arrivalMessages&&<select aria-label={copy.stopSelect} value={selected??""} onChange={event=>onSelect?.(Number(event.target.value))}>
          <option value="" disabled>{copy.stopSelect}</option>{labels.map((label,i)=><option key={i} value={i}>{label}</option>)}
        </select>}
        {map}<footer>{credit}</footer></>}
    </dialog>
  </div>;
}

function MapCanvas({ route, elapsed, selected, mode, labels, locale, indices, onSelect, runs, received, demonstration=false, expanded, arrivalMessages }: MapProps & { expanded:boolean }) {
  const real=received!==undefined;
  const copy=useMemo(()=>real?{...getShuttlePreviewCopy(locale),...getShuttleServiceCopy(locale)}:getShuttlePreviewCopy(locale),[real,locale]);
  const mapLabel=route.id==="hwarangdae-outbound"?`${getShuttleServiceCopy(locale).outboundRegion} · ${copy.routeMap}`:copy.routeMap;
  const visible=useMemo(()=>{
    const visits=indices??route.stops.map((_,i)=>i);
    return real?visits.filter((i,index)=>visits.findIndex(j=>route.stops[j].point.join(",")===route.stops[i].point.join(","))===index):visits;
  },[indices,route,real]);
  const legs=useMemo(()=>real?serviceRoadPaths(route).map(path=>({path,seconds:0,detour:route.id==="hwarangdae-outbound"})):route.legs.filter((_,i)=>visible.includes(i)&&visible.includes(i+1)),[route,visible,real]);
  const activeRuns=useMemo(()=>real?[]:runs??previewRuns(route,"regular",false),[runs,route,real]);
  const element=useRef<HTMLDivElement>(null),map=useRef<KakaoMap | null>(null);
  const pins=useRef(new Map<number, Marker>()),vehicles=useRef(new Map<string, Marker>());
  const overview=useRef(true);
  const popupRef=useRef<KakaoInfoWindow|null>(null);
  const [status,setStatus]=useState<"loading" | "ready" | "unavailable">("loading");
  useEffect(()=>{
    let cancelled=false;
    void loadKakaoMapsSdk().then(ready=>{if(!cancelled)setStatus(ready?"ready":"unavailable");});
    return ()=>{cancelled=true;};
  },[]);

  useEffect(()=>{
    if(status!=="ready"||!element.current) return;
    const container=element.current;
    const sdk=window.kakao?.maps as Maps | undefined;
    if(!sdk||(!real&&!sdk.Polyline)) { setStatus("unavailable"); return; }
    const point=(p: Point)=>new sdk.LatLng(p[0],p[1]);
    const routePins=pins.current;
    const routeVehicles=vehicles.current;
    const assets: {setMap:(map:KakaoMap|null)=>void}[]=[];
    const listeners: {marker: Marker; handler:()=>void}[]=[];
    let resize: ResizeObserver | undefined;
    try {
      map.current=new sdk.Map(container,{center:point(route.stops[0].point),level:5});
      const bounds=new sdk.LatLngBounds();
      legs.forEach(leg=>leg.path.forEach(p=>bounds.extend(point(p))));
      if(real) route.stops.forEach(stop=>bounds.extend(point(stop.point)));
      if(sdk.Polyline) legs.forEach(leg=>{
        const line=new sdk.Polyline({path:leg.path.map(point),strokeWeight:5,strokeColor:leg.detour?"#b7791f":route.color,strokeOpacity:.9,strokeStyle:leg.detour?"dash":"solid",endArrow:true});
        line.setMap(map.current);assets.push(line);
      });
      visible.forEach(i=>{
        const marker=new sdk.Marker({position:point(route.stops[i].point),title:labels.filter((_,j)=>route.stops[j].point.join()===route.stops[i].point.join()).join(" / "),image:stopMarkerImage(sdk,route.color)}) as Marker;
        marker.setMap(map.current);assets.push(marker);routePins.set(i,marker);
        if(onSelect&&(real||i!==visible.at(-1))) {
          const handler=()=>onSelect(i);sdk.event.addListener(marker,"click",handler);listeners.push({marker,handler});
        }
      });
      new Set(activeRuns.map(run=>run.vehicleId)).forEach(vehicleId=>{
        const marker=new sdk.Marker({position:point(route.stops[0].point),title:`${copy[route.name]} · ${copy.vehicle}`,image:vehicleMarkerImage(sdk,route.color)}) as Marker;
        marker.setZIndex(4);assets.push(marker);routeVehicles.set(vehicleId,marker);
      });
      const fit=()=>{overview.current=true;popupRef.current?.close();map.current?.relayout();map.current?.setBounds(bounds,52,28,28,28);};
      fit();
      let width=container.clientWidth,height=container.clientHeight;
      resize=new ResizeObserver(()=>{
        if(!map.current||(width===container.clientWidth&&height===container.clientHeight))return;
        width=container.clientWidth;height=container.clientHeight;
        if(overview.current)fit();
        else {const center=(map.current as KakaoMap&{getCenter:()=>KakaoLatLng}).getCenter();map.current.relayout();map.current.setCenter(center);}
      });resize.observe(container);
    } catch { setStatus("unavailable"); }
    return ()=>{
      resize?.disconnect();listeners.forEach(({marker,handler})=>sdk.event.removeListener(marker,"click",handler));
      assets.forEach(asset=>asset.setMap(null));routeVehicles.forEach(marker=>marker.setMap(null));routePins.clear();routeVehicles.clear();map.current=null;
      container.replaceChildren();
    };
  },[status,route,labels,copy,onSelect,visible,legs,activeRuns,locale,real]);

  useEffect(()=>{
    const sdk=window.kakao?.maps;
    if(!received||status!=="ready"||!sdk||!map.current) return;
    vehicles.current.forEach((marker,id)=>{if(!received.locations.some(bus=>bus.id===id)){marker.setMap(null);vehicles.current.delete(id);}});
    received.locations.forEach(bus=>{
      let marker=vehicles.current.get(bus.id);
      const position=new sdk.LatLng(Number(bus.lat),Number(bus.lon));
      if(!marker) {marker=new sdk.Marker({position,title:`${copy[route.name]} · ${demonstration?copy.vehicle:getShuttleServiceCopy(locale).receivedVehicle}`,image:vehicleMarkerImage(sdk,route.color,received.stale)}) as Marker;marker.setZIndex(6);vehicles.current.set(bus.id,marker);}
      marker.setPosition(position);marker.setImage(vehicleMarkerImage(sdk,route.color,received.stale));marker.setMap(map.current);
    });
  },[received,status,route,copy,locale,demonstration]);

  useEffect(()=>{
    const sdk=window.kakao?.maps;
    if(status!=="ready"||!sdk) return;
    const moving=runningVehicleTrips(route,elapsed,activeRuns);
    if(!real) vehicles.current.forEach((marker,vehicleId)=>{
      const run=moving.find(item=>item.vehicleId===vehicleId);
      if(run) { const point=positionOnRoute(route,elapsed-run.departure); marker.setPosition(new sdk.LatLng(point[0],point[1])); }
      marker.setMap(mode==="ended"||!run?null:map.current);
      marker.setImage(vehicleMarkerImage(sdk,route.color,mode==="delayed"));
    });
    pins.current.forEach((marker,i)=>{
      const active=selected!==null&&route.stops[i].point.join(",")===route.stops[selected].point.join(",");
      marker.setImage(stopMarkerImage(sdk,route.color,active));
      marker.setZIndex(active?5:1);
    });
  },[status,route,elapsed,selected,mode,labels,visible,activeRuns,locale,real]);

  useEffect(()=>{
    const sdk=window.kakao?.maps;
    if(arrivalMessages||selected===null||status!=="ready"||!sdk||!map.current) return;
    const marker=[...pins.current.entries()].find(([i])=>route.stops[i].point.join(",")===route.stops[selected].point.join(","))?.[1];
    if(!marker) return;
    const label=labels[selected].replace(/[&<>\"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[char]!));
    const popup=new sdk.InfoWindow({content:`<div style="padding:8px 12px;font-size:12px;max-width:180px;font-weight:600">${label}</div>`});
    popupRef.current=popup;
    popup.open(map.current,marker);
    return ()=>popup.close();
  },[status,route,selected,labels,visible,arrivalMessages]);

  const points=[...route.stops.map(stop=>stop.point),...legs.flatMap(leg=>leg.path)],latitudes=points.map(p=>p[0]),longitudes=points.map(p=>p[1]);
  const minLat=Math.min(...latitudes),maxLat=Math.max(...latitudes),minLon=Math.min(...longitudes),maxLon=Math.max(...longitudes);
  const project=(point: Point)=>[45+(point[1]-minLon)/(maxLon-minLon||1)*710,315-(point[0]-minLat)/(maxLat-minLat||1)*270];
  return <div className={clsx("relative overflow-hidden border border-neutral-200 bg-neutral-50",expanded?"shuttle-map-canvas-full":"rounded-lg sm:h-80",!expanded&&(real?"h-48":"h-64"))}>
    <div ref={element} onPointerMoveCapture={event=>{if(event.buttons)overview.current=false;}} onWheelCapture={()=>{overview.current=false;}} onDoubleClickCapture={()=>{overview.current=false;}} className={clsx("absolute inset-0",status!=="ready"&&"invisible")} role="region" aria-label={mapLabel} />
    {status!=="ready"&&<div className="absolute inset-0">
      <svg viewBox="0 0 800 360" className="h-full w-full" role="img" aria-label={mapLabel}>
        <rect width="800" height="360" fill="#edf2ed" />
        {legs.map((leg,i)=><polyline key={i} points={leg.path.map(p=>project(p).join(",")).join(" ")} fill="none" stroke={leg.detour?"#b7791f":route.color} strokeWidth="5" strokeDasharray={leg.detour?"9 6":undefined} strokeLinejoin="round" />)}
        {visible.map(i=>{const [x,y]=project(route.stops[i].point);return <g key={i} onClick={()=>onSelect?.(i)} style={{cursor:onSelect?"pointer":undefined}}><image data-stop-pin="true" x={x-20} y={y-44} width="40" height="44" href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(stopPinSvg(route.color,selected===i))}`} /><text x={Math.min(x+22,590)} y={y+16} fontSize="12" fill="#1f2937">{labels[i]}</text></g>;})}
        {mode!=="ended"&&runningVehicleTrips(route,elapsed,activeRuns).map(run=>{const [x,y]=project(positionOnRoute(route,elapsed-run.departure));return <g key={run.vehicleId} data-vehicle-id={run.vehicleId}><title>{`${copy[route.name]} · ${copy.vehicle}`}</title><image x={x-20} y={y-47} width="40" height="48" href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(vehiclePinSvg(route.color,mode==="delayed"))}`} /></g>;})}
        {received?.locations.map(bus=>{const [x,y]=project([Number(bus.lat),Number(bus.lon)]);return <g key={bus.id} data-received-vehicle={bus.id}><title>{`${copy[route.name]} · ${demonstration?copy.vehicle:getShuttleServiceCopy(locale).receivedVehicle}`}</title><image x={x-20} y={y-47} width="40" height="48" href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(vehiclePinSvg(route.color,received.stale))}`} /></g>;})}
      </svg>
      <span className="absolute left-2 top-2 max-w-[85%] rounded bg-white/95 px-2 py-1 text-xs text-neutral-600">{status==="loading"?copy.mapLoading:copy.mapFallback}</span>
    </div>}
  </div>;
}

function stopPinSvg(color:string,active=false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="44" viewBox="0 0 40 44"><path d="M20 29v13m-7 0h14" stroke="${color}" stroke-width="3" stroke-linecap="round"/><rect x="3" y="2" width="34" height="29" rx="9" fill="white" stroke="${color}" stroke-width="${active?4:2}"/><rect x="13" y="6" width="14" height="13" rx="4" fill="${color}"/><path d="M16 9h8v4h-8z" fill="white"/><circle cx="16" cy="16" r="1" fill="white"/><circle cx="24" cy="16" r="1" fill="white"/><text x="20" y="26" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="6" fill="#263238">BUS STOP</text></svg>`;
}
function stopMarkerImage(sdk: KakaoMapsNamespace,color:string,active=false) {
  return new sdk.MarkerImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(stopPinSvg(color,active))}`,new sdk.Size(40,44),{offset:new sdk.Point(20,44)});
}

function vehicleMarkerImage(sdk: KakaoMapsNamespace,routeColor:string,muted=false) {
  return new sdk.MarkerImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(vehiclePinSvg(routeColor,muted))}`,new sdk.Size(40,48),{offset:new sdk.Point(20,47)});
}
