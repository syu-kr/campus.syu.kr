"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/app/components/Modal";
import { Button } from "@/app/components/Button";
import { loadKakaoMapsSdk } from "@/lib/kakao-maps-loader";
import { getShuttlePreviewCopy } from "@/lib/i18n/shuttle-preview";
import { getShuttleServiceCopy } from "@/lib/i18n/shuttle-service-preview";
import { pilotVisits } from "@/lib/shuttle-observations";
import type { BusLocation } from "@/types";
import type { Locale } from "@/lib/i18n";
import type { Point } from "./preview-data";
import { vehiclePinSvg } from "./preview-vehicles";
import { serviceRoadPaths, serviceVisits } from "./service-visits";
import { serviceOutboundRoute, serviceRoutes } from "./service-data";
import { demoStopArrival } from "./service-demo";
import { useStopArrivals } from "./use-stop-arrivals";

type Marker = KakaoMarker & { setPosition: (point: KakaoLatLng) => void; setImage: (image: KakaoMarkerImage) => void; setZIndex: (value: number) => void; setTitle: (title: string) => void };
type Maps = KakaoMapsNamespace & {
  Polyline: new (options: { path: KakaoLatLng[]; strokeWeight: number; strokeColor: string; strokeOpacity: number; strokeStyle: string; endArrow: boolean }) => { setMap: (map: KakaoMap | null) => void };
};
type Visit = ReturnType<typeof pilotVisits>[number];
type Props = {
  received: {locations: BusLocation[]; stale: boolean}; now: Date; locale: Locale; onClose: () => void;
  demo?: {elapsed: number; nextAvailable: boolean; delayed: boolean};
};

export default function ShuttlePreviewMap({received,now,locale,onClose,demo}: Props) {
  const copy=getShuttlePreviewCopy(locale),live=getShuttleServiceCopy(locale);
  const [vehicleId,setVehicleId]=useState<string|null>(null),[stopId,setStopId]=useState<string|null>(null);
  const vehicle=received.locations.find(bus=>bus.id===vehicleId);
  const locationRouteId=vehicle?.routeid,direction=vehicle?.status;
  const route=serviceRoutes.find(item=>item.locationRouteId===vehicle?.routeid);
  const visits=useMemo(()=>!route||!locationRouteId||!direction?[]:route.oneWay&&direction===1?pilotVisits(locationRouteId,direction):serviceVisits[route.id],[route,locationRouteId,direction]);
  const paths=useMemo(()=>{
    if(!route||!direction) return [];
    if(route.oneWay) return serviceRoadPaths(direction===1?serviceOutboundRoute:route);
    return serviceRoadPaths(route);
  },[route,direction]);
  const estimates=useStopArrivals(now,!demo&&!!vehicle&&!received.stale,vehicle?.id);
  const selectVehicle=useCallback((id:string)=>{setVehicleId(id);setStopId(null);},[]);
  const vehicleLabel=useCallback((bus:BusLocation,index:number)=>{
    const item=serviceRoutes.find(item=>item.locationRouteId===bus.routeid)!;
    return `${copy[item.name]} · ${live.vehicleNumber.replace("{number}",String(index+1))} · ${bus.status===2?copy.campusBound:copy.stationBound}`;
  },[copy,live]);
  function arrivalMessage(visit:Visit) {
    if(received.stale) return live.arrivalUnknown;
    if(demo&&route&&vehicle) {
      const index=serviceVisits[route.id].findIndex(item=>item.id===visit.id);
      if(index<0) return live.arrivalUnknown;
      const arrival=demoStopArrival(route,demo.elapsed,index,demo.nextAvailable,demo.delayed,Number(vehicle.id.split("-").at(-1)));
      if(arrival.state==="passed") return copy.passed;
      if(arrival.state==="arrived") return copy.arrived;
      if(arrival.seconds===null) return live.arrivalUnknown;
      const time=`${Math.ceil(arrival.seconds/60)}${locale==="ko"?"":" "}${copy.minutes}`;
      return arrival.state==="waiting"?`${copy.arrived} · ${live.departIn} ${time}`:live.arrivesIn.replace("{time}",time);
    }
    const minutes=estimates.minutes.get(visit.id);
    return minutes===undefined?live.arrivalUnknown:live.arrivesIn.replace("{time}",`${minutes}${locale==="ko"?"":" "}${copy.minutes}`);
  }
  const selectedVisit=visits.find(visit=>visit.id===stopId);
  return <Modal isOpen title={`${live.fleetMap}${demo?` · ${live.demoBadge}`:""}`} onClose={onClose} size="lg" className="shuttle-fleet-dialog" overlayClassName="shuttle-fleet-overlay" bodyClassName="shuttle-fleet-body">
    <div className="shuttle-fleet-layout">
      <FleetCanvas locations={received.locations} stale={received.stale} locale={locale} selectedVehicle={vehicleId} onVehicleSelect={selectVehicle}
        paths={paths} visits={visits} color={route?.color??"#3b82f6"} selectedStop={stopId} onStopSelect={setStopId} vehicleLabel={vehicleLabel}
        stopMessage={selectedVisit?`${selectedVisit.label[locale]} · ${arrivalMessage(selectedVisit)}`:undefined}/>
      <aside className="shuttle-fleet-sidebar">
        {demo&&<p className="text-xs text-neutral-600" role="note">{live.demoShort}</p>}
        <p className="text-sm text-neutral-600">{live.selectVehicle}</p>
        {received.stale&&<p role="status" className="text-sm text-neutral-600">{live.delayedReceipt}</p>}
        <div className="shuttle-fleet-vehicles" role="group" aria-label={live.fleetVehicles}>
          {received.locations.map((bus,index)=><button key={bus.id} type="button" aria-pressed={bus.id===vehicleId} onClick={()=>selectVehicle(bus.id)}>
            <span className="shuttle-preview-route-dot" aria-hidden="true" style={{backgroundColor:serviceRoutes.find(item=>item.locationRouteId===bus.routeid)!.color}}/>{vehicleLabel(bus,index)}
          </button>)}
          {!received.locations.length&&<p role="status">{live.noVehicles}</p>}
        </div>
        {vehicle&&route?<section aria-label={live.vehicleArrivals} className="shuttle-fleet-arrivals">
          <h3 className="font-semibold">{vehicleLabel(vehicle,received.locations.indexOf(vehicle))}</h3>
          <p className="text-xs text-neutral-600">{visits[0].label[locale]} → {visits.at(-1)!.label[locale]}</p>
          <ol>{visits.map(visit=><li key={visit.id}><button type="button" aria-pressed={stopId===visit.id} onClick={()=>setStopId(visit.id)}>
            <span>{visit.label[locale]}</span><strong>{arrivalMessage(visit)}</strong>
          </button></li>)}</ol>
          {!demo&&estimates.status==="collecting"&&<p className="text-xs text-neutral-600">{live.arrivalPendingShort}</p>}
        </section>:vehicleId&&<p role="status">{live.vehicleMissing}</p>}
      </aside>
    </div>
  </Modal>;
}

function FleetCanvas({locations,stale,locale,selectedVehicle,onVehicleSelect,paths,visits,color,selectedStop,onStopSelect,vehicleLabel,stopMessage}: {
  locations:BusLocation[];stale:boolean;locale:Locale;selectedVehicle:string|null;onVehicleSelect:(id:string)=>void;
  paths:Point[][];visits:Visit[];color:string;selectedStop:string|null;onStopSelect:(id:string)=>void;vehicleLabel:(bus:BusLocation,index:number)=>string;
  stopMessage?:string;
}) {
  const live=getShuttleServiceCopy(locale);
  const physicalStops=useMemo(()=>visits.filter((visit,index)=>visits.findIndex(other=>other.point.join()===visit.point.join())===index),[visits]);
  const frame=useRef<HTMLDivElement>(null);
  const [size,setSize]=useState({width:800,height:360});
  const element=useRef<HTMLDivElement>(null),map=useRef<KakaoMap|null>(null),bounds=useRef<KakaoLatLngBounds|null>(null);
  const vehicles=useRef(new Map<string,{marker:Marker;click:()=>void}>()),pins=useRef(new Map<string,Marker>());
  const overview=useRef(true),fitted=useRef(false),previousVehicle=useRef<string|null>(null),previousPaths=useRef<Point[][]|null>(null);
  const [status,setStatus]=useState<"loading"|"ready"|"unavailable">("loading");
  const fit=useCallback(()=>{
    if(!map.current||!bounds.current) return;
    overview.current=true;fitted.current=true;
    map.current.relayout();map.current.setBounds(bounds.current,48,28,28,28);
  },[]);
  useEffect(()=>{
    let cancelled=false;
    void loadKakaoMapsSdk().then(ready=>{if(!cancelled)setStatus(ready?"ready":"unavailable");});
    return()=>{cancelled=true;};
  },[]);
  useEffect(()=>{
    const container=frame.current;if(!container)return;
    let width=0,height=0;
    const resize=()=>{
      if(width===container.clientWidth&&height===container.clientHeight)return;
      width=container.clientWidth;height=container.clientHeight;
      if(width>0&&height>0)setSize({width,height});
      if(!map.current)return;
      if(overview.current)fit();
      else {const center=(map.current as KakaoMap&{getCenter:()=>KakaoLatLng}).getCenter();map.current.relayout();map.current.setCenter(center);}
    };
    resize();const observer=new ResizeObserver(resize);observer.observe(container);
    return()=>observer.disconnect();
  },[fit]);
  useEffect(()=>{
    if(status!=="ready"||!element.current) return;
    const sdk=window.kakao?.maps as Maps|undefined,container=element.current;
    if(!sdk?.Polyline){setStatus("unavailable");return;}
    const markers=vehicles.current;
    try {
      const school=serviceRoutes[0].stops[1].point;
      map.current=new sdk.Map(container,{center:new sdk.LatLng(school[0],school[1]),level:6});
    } catch {setStatus("unavailable");}
    return()=>{
      markers.forEach(({marker,click})=>{sdk.event.removeListener(marker,"click",click);marker.setMap(null);});
      markers.clear();map.current=null;bounds.current=null;fitted.current=false;container.replaceChildren();
    };
  },[status,fit]);
  useEffect(()=>{
    const sdk=window.kakao?.maps;
    if(status!=="ready"||!sdk||!map.current) return;
    vehicles.current.forEach(({marker,click},id)=>{
      if(locations.some(bus=>bus.id===id))return;
      sdk.event.removeListener(marker,"click",click);marker.setMap(null);vehicles.current.delete(id);
    });
    locations.forEach((bus,index)=>{
      const route=serviceRoutes.find(item=>item.locationRouteId===bus.routeid)!;
      let entry=vehicles.current.get(bus.id);
      const position=new sdk.LatLng(Number(bus.lat),Number(bus.lon));
      if(!entry){
        const marker=new sdk.Marker({position,title:vehicleLabel(bus,index),image:vehicleMarkerImage(sdk,route.color,stale)}) as Marker;
        const click=()=>onVehicleSelect(bus.id);sdk.event.addListener(marker,"click",click);
        entry={marker,click};vehicles.current.set(bus.id,entry);
      }
      entry.marker.setPosition(position);entry.marker.setImage(vehicleMarkerImage(sdk,route.color,stale));
      entry.marker.setTitle(vehicleLabel(bus,index));
      entry.marker.setZIndex(bus.id===selectedVehicle?10:6);entry.marker.setMap(map.current);
    });
  },[status,locations,stale,selectedVehicle,onVehicleSelect,vehicleLabel]);
  useEffect(()=>{
    const sdk=window.kakao?.maps as Maps|undefined;
    if(status!=="ready"||!sdk||!map.current) return;
    const assets:{setMap:(map:KakaoMap|null)=>void}[]=[],listeners:{marker:Marker;click:()=>void}[]=[],stops=pins.current;
    paths.forEach(path=>{
      const line=new sdk.Polyline({path:path.map(p=>new sdk.LatLng(p[0],p[1])),strokeWeight:5,strokeColor:color,strokeOpacity:.9,strokeStyle:"solid",endArrow:true});
      line.setMap(map.current);assets.push(line);
    });
    physicalStops.forEach(visit=>{
      const title=visits.filter(other=>other.point.join()===visit.point.join()).map(other=>other.label[locale]).join(" / ");
      const marker=new sdk.Marker({position:new sdk.LatLng(visit.point[0],visit.point[1]),title,image:stopMarkerImage(sdk,color)}) as Marker;
      marker.setMap(map.current);assets.push(marker);stops.set(visit.point.join(),marker);
      const click=()=>onStopSelect(visit.id);sdk.event.addListener(marker,"click",click);listeners.push({marker,click});
    });
    return()=>{listeners.forEach(({marker,click})=>sdk.event.removeListener(marker,"click",click));assets.forEach(asset=>asset.setMap(null));stops.clear();};
  },[status,paths,visits,physicalStops,color,locale,onStopSelect]);
  useEffect(()=>{
    const sdk=window.kakao?.maps;
    if(status!=="ready"||!sdk)return;
    const point=visits.find(visit=>visit.id===selectedStop)?.point.join();
    pins.current.forEach((marker,key)=>{marker.setImage(stopMarkerImage(sdk,color,key===point));marker.setZIndex(key===point?8:2);});
  },[status,selectedStop,color,visits]);
  useEffect(()=>{
    const sdk=window.kakao?.maps;
    if(status!=="ready"||!sdk||!map.current)return;
    const next=new sdk.LatLngBounds();
    serviceRoutes.forEach(route=>route.stops.forEach(stop=>next.extend(new sdk.LatLng(stop.point[0],stop.point[1]))));
    locations.forEach(bus=>next.extend(new sdk.LatLng(Number(bus.lat),Number(bus.lon))));
    paths.forEach(path=>path.forEach(p=>next.extend(new sdk.LatLng(p[0],p[1]))));bounds.current=next;
    if(!fitted.current||previousVehicle.current!==selectedVehicle||(overview.current&&previousPaths.current!==paths))fit();
    previousVehicle.current=selectedVehicle;previousPaths.current=paths;
  },[status,locations,paths,selectedVehicle,fit]);
  const points=[...serviceRoutes.flatMap(route=>route.stops.map(stop=>stop.point)),...paths.flat(),...locations.map(bus=>[Number(bus.lat),Number(bus.lon)] as Point)];
  const minLat=Math.min(...points.map(p=>p[0])),maxLat=Math.max(...points.map(p=>p[0])),minLon=Math.min(...points.map(p=>p[1])),maxLon=Math.max(...points.map(p=>p[1]));
  const project=(point:readonly[number,number])=>[32+(point[1]-minLon)/(maxLon-minLon||1)*(size.width-64),size.height-32-(point[0]-minLat)/(maxLat-minLat||1)*(size.height-80)];
  return <div className="shuttle-fleet-map"><div ref={frame} className="shuttle-fleet-canvas">
    <div ref={element} role="region" aria-label={live.fleetMap} className={status==="ready"?"shuttle-fleet-sdk":"shuttle-fleet-sdk invisible"}
      onPointerMoveCapture={event=>{if(event.buttons)overview.current=false;}} onWheelCapture={()=>{overview.current=false;}} onDoubleClickCapture={()=>{overview.current=false;}}/>
    {status!=="ready"&&<div className="shuttle-fleet-fallback">
      <svg viewBox={`0 0 ${size.width} ${size.height}`} role="group" aria-label={live.fleetMap}>
        <rect width={size.width} height={size.height} fill="#edf2ed"/>
        {paths.map((path,i)=><polyline key={i} points={path.map(p=>project(p).join(",")).join(" ")} fill="none" stroke={color} strokeWidth="5" strokeLinejoin="round"/>)}
        {physicalStops.map(visit=>{const[x,y]=project(visit.point),active=visits.find(item=>item.id===selectedStop)?.point.join()===visit.point.join();return <g key={visit.id} data-stop-pin={visit.id} role="button" tabIndex={0} aria-pressed={active} aria-label={visits.filter(other=>other.point.join()===visit.point.join()).map(other=>other.label[locale]).join(" / ")} onClick={()=>onStopSelect(visit.id)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onStopSelect(visit.id);}}}>
          <title>{visits.filter(other=>other.point.join()===visit.point.join()).map(other=>other.label[locale]).join(" / ")}</title><image x={x-20} y={y-44} width="40" height="44" href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(stopPinSvg(color,active))}`}/>
        </g>;})}
        {locations.map((bus,index)=>{const[x,y]=project([Number(bus.lat),Number(bus.lon)]),route=serviceRoutes.find(item=>item.locationRouteId===bus.routeid)!;return <g key={bus.id} data-received-vehicle={bus.id} role="button" tabIndex={0} aria-pressed={bus.id===selectedVehicle} aria-label={vehicleLabel(bus,index)} onClick={()=>onVehicleSelect(bus.id)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onVehicleSelect(bus.id);}}}>
          <title>{vehicleLabel(bus,index)}</title><image x={x-20} y={y-47} width="40" height="48" href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(vehiclePinSvg(route.color,stale))}`}/>
        </g>;})}
      </svg>
      <span className="shuttle-fleet-map-note">{status==="loading"?live.mapLoading:live.mapFallback}</span>
    </div>}
    {stopMessage&&<p className="shuttle-fleet-stop-message" role="status">{stopMessage}</p>}
    <div className="shuttle-fleet-map-tools"><Button variant="secondary" disabled={status!=="ready"} onClick={fit}>{live.allVehicles}</Button></div>
  </div><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="shuttle-fleet-attribution">© OpenStreetMap</a></div>;
}

function stopPinSvg(color:string,active=false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="44" viewBox="0 0 40 44"><path d="M20 29v13m-7 0h14" stroke="${color}" stroke-width="3" stroke-linecap="round"/><rect x="3" y="2" width="34" height="29" rx="9" fill="white" stroke="${color}" stroke-width="${active?4:2}"/><rect x="13" y="6" width="14" height="13" rx="4" fill="${color}"/><path d="M16 9h8v4h-8z" fill="white"/><circle cx="16" cy="16" r="1" fill="white"/><circle cx="24" cy="16" r="1" fill="white"/><text x="20" y="26" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="6" fill="#263238">BUS STOP</text></svg>`;
}
function stopMarkerImage(sdk:KakaoMapsNamespace,color:string,active=false) {
  return new sdk.MarkerImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(stopPinSvg(color,active))}`,new sdk.Size(40,44),{offset:new sdk.Point(20,44)});
}
function vehicleMarkerImage(sdk:KakaoMapsNamespace,color:string,muted=false) {
  return new sdk.MarkerImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(vehiclePinSvg(color,muted))}`,new sdk.Size(40,48),{offset:new sdk.Point(20,47)});
}
