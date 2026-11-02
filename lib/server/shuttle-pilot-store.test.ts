// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { savePilotSample } from "./shuttle-pilot-store";
import { shuttlePlaces } from "../shuttle-visits";
import type { PilotObservation } from "../shuttle-observations";

const m=vi.hoisted(()=>({records:new Map<string,Record<string,unknown>>(),fail:false}));
type Ref={path:string};
vi.mock("./firestore",()=>({
  admin:{firestore:{Timestamp:{fromMillis:(n:number)=>n}}},
  getFirestore:()=>({
    collection:(name:string)=>({doc:(id:string)=>({path:`${name}/${id}`})}),
    runTransaction:async(run:(transaction:unknown)=>Promise<unknown>)=>{
      const writes:{ref:Ref;data:Record<string,unknown>;create:boolean}[]=[];
      const read=(ref:Ref)=>{
        if(writes.length)throw new Error("Read after transaction write");
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
beforeEach(()=>{m.records.clear();m.fail=false;});

it("stores the actual observation clock, its basis, trip and candidate events atomically",async()=>{
  expect(await savePilotSample([point()],time,()=>undefined)).toBe("saved");
  expect(frame()).toMatchObject({schemaVersion:2,measuredAt:time,observedAt:time,measurementSource:"receiver",expires_at:time+30*86400_000,
    rows:[expect.objectContaining({runId:expect.any(String),measuredAt:time,measurementSource:"receiver",sourceMeasuredAt:null})],
    events:[expect.objectContaining({event:"arrival",validation:"candidate"})]});
  expect(m.records.get("shuttle_pilot_state/daily-key")).toMatchObject({observedAt:time});
});
it("preserves device measurement time separately when supplied",async()=>{
  await savePilotSample([{...point(),measuredAt:time-1000,measurementSource:"source"}],time,()=>undefined);
  expect(frame()).toMatchObject({rows:[expect.objectContaining({measuredAt:time-1000,sourceMeasuredAt:time-1000,measurementSource:"source"})]});
});
it("deduplicates the same receiver receipt, but retains two new receipts in one minute",async()=>{
  await savePilotSample([point()],time,()=>undefined);
  expect(await savePilotSample([point()],time,()=>undefined)).toBe("duplicate");
  expect(await savePilotSample([point(30_000)],time+30_000,()=>undefined)).toBe("saved");
  expect(m.records.size).toBe(3);
  expect(frame(time+30_000)).toMatchObject({rows:[expect.objectContaining({runId:(frame().rows as {runId:string}[])[0].runId})]});
});
it("retains a late raw receipt without reversing the latest run cursor",async()=>{
  await savePilotSample([point(30_000)],time+30_000,()=>undefined);
  await savePilotSample([point()],time,()=>undefined);
  expect(m.records.get("shuttle_pilot_state/daily-key")).toMatchObject({observedAt:time+30_000});
  expect(frame()).toMatchObject({events:[],rows:[expect.objectContaining({advanced:false,runId:null})]});
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
});
