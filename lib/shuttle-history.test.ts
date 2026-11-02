import {expect,it} from "vitest";
import {buildShuttleHistory} from "./shuttle-history";
const row=(station:string,timeHHMM:string,vehicleAlias="a")=>({station,timeHHMM,vehicleAlias,date:"2026-10-30"});
it("imports every station but only joins ordered, same-day original vehicle detections",()=>{
  const r=buildShuttleHistory({rows:[row("화랑대역","08:00"),row("별내역","11:00","b"),row("석계역","13:00"),row("태릉입구역","13:04"),row("석계역","14:00","c"),row("태릉입구역","14:05","d")]});
  expect(r.summary).toMatchObject({detections:6,linkedPairs:1,precisionSeconds:60,identityVerified:false});
  expect(r.profiles["seokgye-4"]).toMatchObject({seconds:240,n:1});
  expect(JSON.stringify(r.events)).not.toContain("vehicleAlias");
});
it("does not turn a zero time, intervening station or midnight crossing into travel",()=>{
  const r=buildShuttleHistory({rows:[row("석계역","13:00"),row("화랑대역","13:02"),row("태릉입구역","13:04"),row("석계역","14:00"),row("태릉입구역","14:00"),{...row("태릉입구역","00:04"),date:"2026-10-31"}]});
  expect(r.summary.linkedPairs).toBe(0);
});
it("rejects malformed dates, times and unknown stations",()=>{
  for(const bad of [{...row("석계역","13:00"),date:"2026-02-30"},row("석계역","25:00"),row("unknown","13:00"),row("__proto__","13:00")])expect(()=>buildShuttleHistory({rows:[bad]})).toThrow();
});
