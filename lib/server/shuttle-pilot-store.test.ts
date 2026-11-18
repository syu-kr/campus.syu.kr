// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
let savePilotSample: typeof import("./shuttle-pilot-store").savePilotSample;
import { shuttlePlaces } from "../shuttle-visits";
import type { PilotObservation } from "../shuttle-observations";

const m=vi.hoisted(()=>({records:new Map<string,Record<string,unknown>>(),fail:false,reads:0}));
type Ref={path:string};
vi.mock("./firestore",()=>({
  admin:{firestore:{Timestamp:{fromMillis:(n:number)=>n}}},
  getFirestore:()=>({
    collection:(name:string)=>({doc:(id:string)=>({path:`${name}/${id}`})}),
    runTransaction:async(run:(transaction:unknown)=>Promise<unknown>)=>{
      const writes:{ref:Ref;data:Record<string,unknown>;create:boolean}[]=[];
      const read=(ref:Ref)=>{
        if(writes.length)throw new Error("Read after transaction write");
        m.reads++;
        return {exists:m.records.has(ref.path),data:()=>m.records.get(ref.path)};
      };
      const result=await run({getAll:async(...refs:Ref[])=>refs.map(read),get:async(ref:Ref)=>read(ref),
        create:(ref:Ref,data:Record<string,unknown>)=>writes.push({ref,data,create:true}),
        set:(ref:Ref,data:Record<string,unknown>)=>writes.push({ref,data,create:false})});
      if(m.fail)throw new Error("Commit failed");
      for(const write of writes){if(write.create&&m.records.has(write.ref.path))throw new Error("Duplicate create");}
      for(const write of writes)m.records.set(write.ref.path,write.data);
      return result;
    },
  }),
}));
const time=Date.parse("2026-11-02T09:00:00+09:00");
const point=(offset=0):PilotObservation=>({vehicleKey:"daily-key",routeId:1,status:2,pattern:"fall-online",
  lat:shuttlePlaces.hwarang5.point[0],lon:shuttlePlaces.hwarang5.point[1],observedAt:time+offset,
  measuredAt:time+offset,measurementSource:"receiver"});
const frame=(at=time)=>m.records.get(`shuttle_pilot_receipts/${at}`)!;
beforeEach(async()=>{vi.resetModules();m.records.clear();m.fail=false;m.reads=0;({savePilotSample}=await import("./shuttle-pilot-store"));});

it("stores the actual observation clock, its basis, trip and candidate events atomically",async()=>{
  expect(await savePilotSample([point()],time,()=>undefined)).toBe("saved");
  expect(frame()).toMatchObject({schemaVersion:2,measuredAt:time,observedAt:time,measurementSource:"receiver",expires_at:time+30*86400_000,
    rows:[expect.objectContaining({runId:expect.any(String),measuredAt:time,measurementSource:"receiver",sourceMeasuredAt:null})],
    events:[expect.objectContaining({event:"arrival",validation:"candidate"})]});
  expect(m.records.get("shuttle_eta/current")).toMatchObject({cursors:[expect.objectContaining({observedAt:time})]});
});
it("preserves device measurement time separately when supplied",async()=>{
  await savePilotSample([{...point(),measuredAt:time-1000,measurementSource:"source"}],time,()=>undefined);
  expect(frame()).toMatchObject({rows:[expect.objectContaining({measuredAt:time-1000,sourceMeasuredAt:time-1000,measurementSource:"source"})]});
});
it("skips repeated storage reads until a full minute elapsed since the saved receipt",async()=>{
  await savePilotSample([point()],time,()=>undefined);
  const reads=m.reads;
  expect(await savePilotSample([point()],time,()=>undefined)).toBe("duplicate");
  expect(await savePilotSample([point(30_000)],time+30_000,()=>undefined)).toBe("duplicate");
  expect(m.reads).toBe(reads);
  expect(await savePilotSample([point(60_000)],time+60_000,()=>undefined)).toBe("saved");
  expect(m.records.size).toBe(3);
  expect(m.records.get("shuttle_eta/current")).toMatchObject({schemaVersion:3,receivedAt:time+60_000});
  expect(frame(time+60_000)).toMatchObject({rows:[expect.objectContaining({runId:(frame().rows as {runId:string}[])[0].runId})]});
});
it("does not treat a minute bucket boundary as a full elapsed minute",async()=>{
  await savePilotSample([point(59900)],time+59900,()=>undefined);
  vi.resetModules();const other=await import("./shuttle-pilot-store");
  expect(await other.savePilotSample([point(60100)],time+60100,()=>undefined)).toBe("duplicate");
  const reads=m.reads;
  expect(await other.savePilotSample([point(110000)],time+110000,()=>undefined)).toBe("duplicate");
  expect(m.reads).toBe(reads);
  expect(await other.savePilotSample([point(119900)],time+119900,()=>undefined)).toBe("saved");
  expect(frame(time+60100)).toBeUndefined();
});
it("skips a late raw receipt without reversing the latest run cursor",async()=>{
  await savePilotSample([point(30_000)],time+30_000,()=>undefined);
  await savePilotSample([point()],time,()=>undefined);
  expect(m.records.get("shuttle_eta/current")).toMatchObject({cursors:[expect.objectContaining({observedAt:time+30_000})]});
  expect(frame()).toBeUndefined();
});
it("records and deduplicates an operator field event separately from a receiver candidate",async()=>{
  await savePilotSample([point()],time,()=>undefined);
  const event={vehicleId:"not-stored-vehicle",vehicleKey:"daily-key",visitId:"hwarangdae-5-campus",event:"departure" as const,observedAt:time+2000};
  expect(await savePilotSample([point()],time,()=>undefined,event)).toBe("saved");
  expect(await savePilotSample([point()],time,()=>undefined,event)).toBe("duplicate");
  const field=[...m.records.entries()].find(([path])=>path.includes("field-"))![1];
  expect(field).toMatchObject({measurementSource:"field-observer",measuredAt:time+2000,
    events:[expect.objectContaining({event:"departure",method:"field-observer",validation:"reported"})]});
  expect(JSON.stringify([...m.records.values()])).not.toContain("not-stored-vehicle");
});
it("saves a new field receipt immediately and moves the automatic watermark to that receipt",async()=>{
  await savePilotSample([point()],time,()=>undefined);
  expect(await savePilotSample([point(10000)],time+10000,()=>undefined,{vehicleId:"not-stored",vehicleKey:"daily-key",visitId:"hwarangdae-5-campus",event:"departure",observedAt:time+11000})).toBe("saved");
  const reads=m.reads;
  expect(await savePilotSample([point(60000)],time+60000,()=>undefined)).toBe("duplicate");
  expect(m.reads).toBe(reads);
  expect(await savePilotSample([point(70000)],time+70000,()=>undefined)).toBe("saved");
});
it("does not attribute a delayed field report to another direction's newer run",async()=>{
  await savePilotSample([{...point(30_000),status:1}],time+30_000,()=>undefined);
  expect(await savePilotSample([point()],time,()=>undefined,{vehicleId:"test",vehicleKey:"daily-key",visitId:"hwarangdae-5-campus",event:"arrival",observedAt:time})).toBe("delayed");
  expect(m.records.size).toBe(2);
});
it.each(["closed","delayed"] as const)("rechecks %s immediately before committing",async state=>{
  let checks=0;
  expect(await savePilotSample([point()],time,()=>++checks===1?undefined:state)).toBe(state);
  expect(m.records.size).toBe(0);
});
it("reports a failed commit without leaving partial state or acknowledging a save",async()=>{
  m.fail=true;
  await expect(savePilotSample([point()],time,()=>undefined)).rejects.toThrow("Commit failed");
  expect(m.records.size).toBe(0);
  m.fail=false;expect(await savePilotSample([point()],time,()=>undefined)).toBe("saved");
});
it("keeps a coalesced delayed result from being acknowledged as a duplicate save",async()=>{
  let checks=0;
  const first=savePilotSample([point()],time,()=>++checks>=2?"delayed":undefined);
  const second=savePilotSample([point()],time+100,()=>undefined);
  expect(await Promise.all([first,second])).toEqual(["delayed","delayed"]);
  expect(m.records.size).toBe(0);
});
it("clears vanished vehicles on fresh empty frames while retaining the learned model",async()=>{
  await savePilotSample([point()],time,()=>undefined);
  await savePilotSample([],time+60000,()=>undefined);
  expect(m.records.get("shuttle_eta/current")).toMatchObject({receivedAt:time+60000,runs:[]});
  expect(frame(time+60000)).toMatchObject({rows:[]});
  expect(await savePilotSample([],time+120000,()=>undefined)).toBe("duplicate");
  const reads=m.reads;
  expect(await savePilotSample([],time+125000,()=>undefined)).toBe("duplicate");
  expect(m.reads).toBe(reads);expect(frame(time+120000)).toBeUndefined();
});
it("coalesces same-window viewers and skips a different worker's later receipt in that window",async()=>{
  const results=await Promise.all(Array.from({length:10},(_,i)=>savePilotSample([point(i*100)],time+i*100,()=>undefined)));
  expect(results.filter(result=>result==="saved")).toHaveLength(1);
  expect([...m.records.keys()].filter(key=>key.startsWith("shuttle_pilot_receipts/"))).toHaveLength(1);
  vi.resetModules();
  const other=await import("./shuttle-pilot-store");
  expect(await other.savePilotSample([point(1000)],time+1000,()=>undefined)).toBe("duplicate");
  const reads=m.reads;
  expect(await other.savePilotSample([point(20000)],time+20000,()=>undefined)).toBe("duplicate");
  expect(m.reads).toBe(reads);
  expect([...m.records.keys()].filter(key=>key.startsWith("shuttle_pilot_receipts/"))).toHaveLength(1);
});
it("migrates a legacy cursor once and keeps later cursors in the current document",async()=>{
  await savePilotSample([point()],time,()=>undefined);
  const legacy=m.records.get("shuttle_eta/current")!;
  const cursors=legacy.cursors as Record<string,unknown>[];
  const runId=cursors[0].runId;
  m.records.set("shuttle_pilot_state/daily-key",cursors[0]);
  delete legacy.cursors;
  await savePilotSample([point(60000)],time+60000,()=>undefined);
  expect(m.records.get("shuttle_eta/current")).toMatchObject({cursors:[expect.objectContaining({runId,observedAt:time+60000})]});
  expect(m.records.get("shuttle_pilot_state/daily-key")).toMatchObject({observedAt:time});
});
it("restores anonymized aggregates after raw live state expires",async()=>{
  const profiles={"hwarangdae-5-campus":{seconds:480,n:20,cells:{}}};
  m.records.set("shuttle_eta/model",{profiles,schemaVersion:1});
  await savePilotSample([point()],time,()=>undefined);
  expect(m.records.get("shuttle_eta/current")).toMatchObject({profiles});
  expect(m.records.get("shuttle_eta/model")).not.toHaveProperty("expires_at");
  expect(JSON.stringify(m.records.get("shuttle_eta/model"))).not.toContain("daily-key");
});
it("keeps a late cached field event without reversing the latest position clock",async()=>{
  await savePilotSample([point()],time,()=>undefined);
  await savePilotSample([point(60_000)],time+60_000,()=>undefined);
  await savePilotSample([point()],time,()=>undefined,{vehicleId:"not-stored",vehicleKey:"daily-key",visitId:"hwarangdae-5-campus",event:"departure",observedAt:time+61_000});
  const current=m.records.get("shuttle_eta/current")!;
  expect(current.receivedAt).toBe(time+60_000);
  expect(current.runs).toEqual([expect.objectContaining({observedAt:time+60_000})]);
  expect(current.pending).toContainEqual(expect.objectContaining({method:"field-observer",observedAt:time+61_000}));
});
