import { expect,it } from "vitest";
import { stopArrivalLabels } from "./service-arrival-labels";
import { serviceRoutes } from "./service-data";
const route=serviceRoutes[1],now=new Date("2026-11-02T13:20:00+09:00");
it("uses the published origin departure even when a live ETA exists",()=>{
  const rows=stopArrivalLabels(route,"ko",false,0,true,false,false,new Map([["seokgye-campus-departure",2]]),{now,departures:["13:15","13:30"],scheduled:new Map(),progress:[]});
  expect(rows[0].eta).toBe("13:30 출발 예정");expect(rows[0].detail).toContain("10분");expect(rows[0].verified).toBe(false);
});
it("shows the next scheduled trip plus learned travel time, and last bus passed only after a confirmed pass",()=>{
  const scheduled=new Map([["seokgye-hwarangdae-2",{visitId:"seokgye-hwarangdae-2",departureAt:+now+10*60000,arrivalAt:+now+17*60000,travelSeconds:420}]]);
  const context={now,departures:["13:15","13:30"],scheduled,progress:[{position:2.2}]};
  const next=stopArrivalLabels(route,"ko",false,0,true,false,false,undefined,context);
  expect(next[1]).toMatchObject({eta:"약 17분",following:"다음 버스"});expect(next[1].detail).toContain("13:30");
  const oldTrip=new Map([["seokgye-hwarangdae-2",{visitId:"seokgye-hwarangdae-2",departureAt:+now-5*60000,arrivalAt:+now+5*60000,travelSeconds:600}]]);
  const passed=stopArrivalLabels(route,"ko",false,0,true,false,false,undefined,{...context,scheduled:oldTrip});
  expect(passed[1]).toMatchObject({eta:"약 20분",following:"다음 버스"});expect(passed[1].detail).toContain("13:30");
  const last=stopArrivalLabels(route,"ko",false,0,true,false,false,undefined,{...context,departures:["13:15"],scheduled:new Map()});
  expect(last[1].eta).toBe("막차 통과");expect(last[3].eta).not.toBe("막차 통과");
});
