import {expect,it} from "vitest";
import {advanceShuttleLearning,learningArrivals,scheduledShuttleArrivals,scheduledShuttleTrips,projectShuttlePoint,recordTravel,type LearningPoint,type TimingProfiles} from "./shuttle-learning";
import {pointAlongPath,serviceRoadPaths} from "@/app/campus/bus-info/preview/service-visits";
import type {PilotEvent} from "./shuttle-observations";
const t=Date.parse("2026-11-02T13:20:00+09:00");
it("returns complete same-trip visits for active trips and only the next future departure",()=>{
  const trips=scheduledShuttleTrips({},{},{2:[t-5*60000,t,t+10*60000,t+20*60000]},{2:"online"},t+8*60000);
  expect(trips.filter(trip=>trip.departureAt>t+8*60000).map(trip=>trip.departureAt)).toEqual([t+10*60000]);
  expect(trips.filter(trip=>trip.departureAt<=t+8*60000)).toHaveLength(2);
  for(const trip of trips) {
    expect(trip.stops).toHaveLength(6);
    expect(new Set(trip.stops.map(stop=>stop.departureAt))).toEqual(new Set([trip.departureAt]));
    expect(trip.stops.every(stop=>stop.tripKey===trip.key)).toBe(true);
    expect(trip.stops.slice(1).every((stop,index)=>stop.arrivalAt>trip.stops[index].arrivalAt)).toBe(true);
  }
});
it("recomputes the next departure in its own time cell and rejects malformed learned values",()=>{
  const profiles={"seokgye-campus-departure":{seconds:600,n:30,cells:{"online:1:27":{seconds:1200,n:100,at:t}}}};
  const trips=scheduledShuttleTrips({},profiles,{2:[t-5*60000,t+10*60000]},{2:"online"},t);
  expect(trips.find(trip=>trip.departureAt===t+10*60000)!.stops[1].travelSeconds).toBe(1171);
  expect(trips.find(trip=>trip.departureAt===t-5*60000)!.stops[1].travelSeconds).toBe(600);
  const bad={"seokgye-campus-departure":{seconds:NaN,n:NaN,cells:{}}};
  const fallback=scheduledShuttleTrips(bad,bad,{2:[t]},{2:"online"},t)[0].stops[1];
  expect(Number.isFinite(fallback.arrivalAt)).toBe(true);expect(fallback.basis).toBe("route");
});
it("adds learned travel time to the next scheduled departure and advances after a trip passes",()=>{
  const plans={2:[t+5*60000,t+20*60000]},from="seokgye-campus-departure";
  const profiles={[from]:{seconds:600,n:30,cells:{}}};
  const first=scheduledShuttleArrivals({},profiles,plans,{2:"online"},t);
  expect(first.find(r=>r.visitId===from)).toMatchObject({departureAt:t+5*60000,arrivalAt:t+5*60000,travelSeconds:0});
  expect(first.find(r=>r.visitId==="seokgye-hwarangdae-2")).toMatchObject({departureAt:t+5*60000,arrivalAt:t+15*60000,travelSeconds:600});
  const next=scheduledShuttleArrivals({},profiles,plans,{2:"online"},t+16*60000);
  expect(next.find(r=>r.visitId==="seokgye-hwarangdae-2")?.departureAt).toBe(t+20*60000);
  expect(scheduledShuttleArrivals({},profiles,plans,{},t)).toEqual([]);
  expect(scheduledShuttleArrivals({},profiles,plans,{2:"online"},t+86400000)).toEqual([]);
});
const point=(fraction=.5,offset=0):LearningPoint=>{
  const p=pointAlongPath(serviceRoadPaths({id:"seokgye"})[3],fraction);
  return{vehicleKey:"private-vehicle",runId:"private-run",routeId:2,status:2,pattern:"online",lat:p[0],lon:p[1],observedAt:t+offset,measuredAt:t+offset,measurementSource:"receiver",advanced:true};
};
const event=(visitId:string,event:PilotEvent["event"],offset:number,extra:Partial<PilotEvent>={}):PilotEvent=>({
  vehicleKey:"private-vehicle",runId:"private-run",routeId:2,status:2,pattern:"online",visitId,event,observedAt:t+offset,
  measuredAt:t+offset,windowStart:null,windowEnd:t+offset,measurementSource:"field-observer",method:"field-observer",validation:"reported",...extra,
});
it("starts estimates from the imported history without an independent validation gate",()=>{
  const state=advanceShuttleLearning(undefined,[point()],[],t);
  const history={"seokgye-4":{seconds:300,n:259,cells:{}}};
  const result=learningArrivals(state,history,{2:[]},t);
  const first=result.find(r=>r.visitId==="seokgye-taereung-7")!;
  expect(first.arrivalAt-t).toBeCloseTo(150000,-3);
  expect(first).toMatchObject({basis:"history",measurementSource:"receiver",validUntil:t+90000});
  expect(JSON.stringify(result)).not.toMatch(/private-run|private-vehicle|\blat\b|\blon\b/);
});
it("uses road references for unobserved legs, and adapts to the current vehicle's pace",()=>{
  const initial=advanceShuttleLearning(undefined,[point(.1)],[],t);
  const later=advanceShuttleLearning(initial,[point(.2,30000)],[],t+30000);
  expect(later.runs[0].paceSeconds).toBeCloseTo(300,-1);
  const adaptive=learningArrivals(later,{}, {2:[]},t+30000)[0];
  const unchanged=learningArrivals({...later,runs:later.runs.map(r=>({...r,paceSeconds:null}))},{},{2:[]},t+30000)[0];
  expect(adaptive.arrivalAt).toBeGreaterThan(unchanged.arrivalAt);
  expect(adaptive.basis).toBe("route");
});
it("learns a completed field segment once, and does not join different trips",()=>{
  const departure=event("seokgye-4","departure",0),arrival=event("seokgye-taereung-7","arrival",240000);
  const first=advanceShuttleLearning(undefined,[],[departure],t);
  expect(advanceShuttleLearning(first,[],[{...arrival,runId:"other"}],t+240000).profiles).toEqual({});
  const learned=advanceShuttleLearning(first,[],[arrival],t+240000);
  expect(learned.profiles["seokgye-4"]).toMatchObject({n:1,seconds:240});
  expect(advanceShuttleLearning(learned,[],[arrival],t+240000).profiles["seokgye-4"].n).toBe(1);
});
it("separates time-of-day and service-pattern cells and bounds their growth",()=>{
  const profiles:TimingProfiles={};
  for(let i=0;i<100;i++)recordTravel(profiles,"seokgye-4",100+i,t+i*1800000,`pattern-${i}`);
  expect(profiles["seokgye-4"].n).toBe(100);
  expect(Object.keys(profiles["seokgye-4"].cells)).toHaveLength(64);
  recordTravel(profiles,"seokgye-4",-1,t,"bad");expect(profiles["seokgye-4"].n).toBe(100);
});
it("keeps scheduled departures as origin waiting, never as a headway travel estimate",()=>{
  const p=pointAlongPath(serviceRoadPaths({id:"hwarangdae"})[0],0);
  const initial=advanceShuttleLearning(undefined,[{...point(),routeId:1,status:2,lat:p[0],lon:p[1]}],[],t);
  const state=advanceShuttleLearning(initial,[{...point(0,5000),routeId:1,status:2,lat:p[0],lon:p[1]}],[],t+5000);
  const normal=learningArrivals(state,{}, {1:[]},t+5000)[0];
  const held=learningArrivals(state,{}, {1:[t+125000]},t+5000)[0];
  expect(held.arrivalAt-normal.arrivalAt).toBe(120000);
  expect(learningArrivals(state,{}, {1:[t+30*60000]},t+5000)).toEqual([]);
});
it("rejects stale, future, off-route, wrong service and conflicting vehicle states",()=>{
  const state=advanceShuttleLearning(undefined,[point()],[],t);
  expect(learningArrivals(state,{}, {2:[]},t+90000)).toEqual([]);
  expect(learningArrivals(state,{}, {2:[]},t-1)).toEqual([]);
  expect(learningArrivals(state,{}, {},t)).toEqual([]);
  expect(learningArrivals({...state,runs:state.runs.map(r=>({...r,status:1}))}, {},{2:[]},t)).toEqual([]);
  expect(learningArrivals({...state,runs:[...state.runs,...state.runs]}, {},{2:[]},t)).toEqual([]);
  expect(advanceShuttleLearning(undefined,[{...point(),lat:37.7}],[],t).runs).toEqual([]);
  expect(advanceShuttleLearning(undefined,[{...point(),routeId:1,status:1}],[],t).runs).toEqual([]);
  expect(learningArrivals(state,{}, {2:[]},t,"another-vehicle")).toEqual([]);
});
it("does not move progress backwards, and preserves a cached observation on a field report",()=>{
  const state=advanceShuttleLearning(undefined,[point(.8)],[],t);
  expect(advanceShuttleLearning(state,[point(.1,5000)],[],t+5000).runs).toEqual([]);
  expect(advanceShuttleLearning(state,[{...point(.8),advanced:false}],[],t).runs).toEqual(state.runs);
  expect(advanceShuttleLearning(state,[point(.1,-1)],[],t-1)).toBe(state);
  expect(projectShuttlePoint([37,127],[[37,127],[37.001,127]]).fraction).toBe(0);
});
