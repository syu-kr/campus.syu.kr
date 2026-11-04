import { expect,it } from "vitest";
import { stopArrivalLabels } from "./service-arrival-labels";
import { serviceRoutes } from "./service-data";
import { demoEventTime } from "./service-demo";
const route=serviceRoutes[1],now=new Date("2026-11-02T13:20:00+09:00");
it("uses the published origin departure even when a live ETA exists",()=>{
  const rows=stopArrivalLabels(route,"ko",false,0,true,false,false,new Map([["seokgye-campus-departure",2]]),{now,departures:["13:15","13:30"],scheduled:new Map(),progress:[]});
  expect(rows[0].eta).toBe("13:30 출발 예정");expect(rows[0].detail).toContain("10분");expect(rows[0].verified).toBe(false);
});
it("uses the independently computed trip and never infers last-bus passage from an unrelated position",()=>{
  const scheduled=new Map([["seokgye-hwarangdae-2",{visitId:"seokgye-hwarangdae-2",departureAt:+now+10*60000,arrivalAt:+now+17*60000,travelSeconds:420}]]);
  const context={now,departures:["13:15","13:30"],scheduled,progress:[{position:2.2}]};
  const next=stopArrivalLabels(route,"ko",false,0,true,false,false,undefined,context);
  expect(next[1]).toMatchObject({eta:"약 17분",following:"다음 버스"});expect(next[1].detail).toContain("13:30");
  const oldTrip=new Map([["seokgye-hwarangdae-2",{visitId:"seokgye-hwarangdae-2",departureAt:+now-5*60000,arrivalAt:+now+5*60000,travelSeconds:600}]]);
  const passed=stopArrivalLabels(route,"ko",false,0,true,false,false,undefined,{...context,scheduled:oldTrip});
  expect(passed[1]).toMatchObject({eta:"약 5분",arrivalClock:"13:25",source:"scheduled"});expect(passed[1].detail).toContain("13:15");
  const last=stopArrivalLabels(route,"ko",false,0,true,false,false,undefined,{...context,departures:["13:15"],scheduled:new Map()});
  expect(last[1].eta).not.toBe("막차 도착");expect(last[3].eta).not.toBe("막차 도착");
});
it("advances within an existing response using the next trip's own time cell, including an already departed trip",()=>{
  const visitId="seokgye-hwarangdae-2";
  const trips=[{key:"next",route:"seokgye" as const,pattern:"online",departureAt:+now-60000,stops:[
    {visitId,departureAt:+now-60000,arrivalAt:+now+19*60000,travelSeconds:1200,basis:"history" as const,tripKey:"next"},
  ]}];
  const old={visitId,departureAt:+now-20*60000,arrivalAt:+now-10*60000,travelSeconds:600};
  const rows=stopArrivalLabels(route,"ko",false,0,true,false,false,undefined,{now,departures:["13:00","13:19"],scheduled:new Map([[visitId,old]]),progress:[],trips});
  expect(rows[1]).toMatchObject({eta:"약 19분",arrivalClock:"13:39",basis:"history",tripKey:"next"});
  const ended=stopArrivalLabels(route,"ko",false,0,true,false,false,undefined,{now,departures:["13:00"],scheduled:new Map([[visitId,old]]),progress:[]});
  expect(ended[1].eta).toBe("막차 도착");expect(ended[1].verified).toBe(false);
  expect(ended[0].eta).toBe("막차 출발");
});
it("names the final simulated arrival and passage while keeping earlier arrivals generic",()=>{
  const demoDepartures=[0,1800],index=route.stops.length-1;
  const at=demoEventTime(route,index,false,demoDepartures);
  const context={now,departures:[],scheduled:new Map(),progress:[],demoDepartures};
  expect(stopArrivalLabels(route,"ko",true,at,true,false,false,undefined,context)[index].eta).toBe("도착");
  expect(stopArrivalLabels(route,"ko",true,at,false,false,false,undefined,context)[index].eta).toBe("막차 도착");
  expect(stopArrivalLabels(route,"ko",true,at+1800,true,false,false,undefined,context)[index].eta).toBe("막차 도착");
  const passed=demoEventTime(route,index,true,demoDepartures);
  expect(stopArrivalLabels(route,"ko",true,passed,false,false,false,undefined,context)[index].eta).toBe("막차 도착");
  expect(stopArrivalLabels(route,"en",true,at,false,false,false,undefined,context)[index].eta).toBe("Last bus arrived");
});
it("uses the exact observed arrival for the clock and leaves a delayed final trip visible",()=>{
  const visitId="seokgye-taereung-7",row={visitId,arrivalAt:+now+61000,measuredAt:+now-1000,validUntil:+now+89000};
  const result=stopArrivalLabels(route,"ko",false,0,true,false,false,new Map([[visitId,2]]),{now,departures:["13:00"],scheduled:new Map(),progress:[],observations:new Map([[visitId,row]])});
  expect(result[4]).toMatchObject({eta:"약 2분",arrivalClock:"13:21",source:"observed",measuredAt:row.measuredAt});
});
it("completes the final published trip after ten minutes, while valid observations remain authoritative",()=>{
  const visitId="seokgye-hwarangdae-2",departureAt=+now-20*60000,arrivalAt=+now-10*60000;
  const final={visitId,departureAt,arrivalAt,travelSeconds:600};
  const context={now,departures:["13:00","12:45"],scheduled:new Map([[visitId,final]]),progress:[]};
  const labels=(at:number,estimates?:ReadonlyMap<string,number>)=>stopArrivalLabels(route,"ko",false,0,true,false,false,estimates,{...context,now:new Date(at)});
  expect(labels(arrivalAt)[1].eta).toBe("막차 도착 예상");
  expect(labels(+now-1)[1].eta).toBe("막차 도착 예상");
  expect(labels(+now)[1].eta).toBe("막차 도착");
  expect(labels(+now,new Map([[visitId,3]]))[1]).toMatchObject({eta:"약 3분",source:"observed"});
  const earlier={visitId,departureAt:+now-35*60000,arrivalAt:+now+20*60000,travelSeconds:3300};
  const trips=[{key:"final",route:"seokgye" as const,pattern:"semester",departureAt,stops:[final]}];
  const completed=stopArrivalLabels(route,"ko",false,0,true,false,false,undefined,{...context,scheduled:new Map([[visitId,earlier]]),trips});
  expect(completed[1].eta).toBe("막차 도착");
  const missing=stopArrivalLabels(route,"ko",false,0,true,false,false,undefined,{...context,scheduled:new Map([[visitId,{...earlier,arrivalAt:+now-30*60000}]])});
  expect(missing[1].eta).toBe("막차 도착 예상");
});
it("marks the origin departed at its final published departure time",()=>{
  const rows=stopArrivalLabels(route,"ko",false,0,true,false,false,undefined,{now,departures:["13:20"],scheduled:new Map(),progress:[]});
  expect(rows[0].eta).toBe("막차 출발");
});
