// @vitest-environment node
import {mkdirSync,writeFileSync} from "node:fs";
import path from "node:path";
import {performance} from "node:perf_hooks";
import {afterEach,expect,it,vi} from "vitest";
import {shuttlePlaces} from "../shuttle-visits";
import type {PilotObservation} from "../shuttle-observations";

type Ref={path:string};
type Write={ref:Ref;data:Record<string,unknown>;create:boolean};
const mock=vi.hoisted(()=>({
  records:new Map<string,Record<string,unknown>>(),reads:0,writes:0,attempts:0,
  rollbackOnce:false,failOnce:false,tail:Promise.resolve() as Promise<unknown>,
}));
vi.mock("./firestore",()=>({
  admin:{firestore:{Timestamp:{fromMillis:(n:number)=>n}}},
  getFirestore:()=>({
    collection:(name:string)=>({doc:(id:string)=>({path:name+"/"+id})}),
    runTransaction:(run:(transaction:unknown)=>Promise<unknown>)=>{
      // Serialize lock holders like a server transaction, and discard all staged writes on retry.
      const operation=mock.tail.then(async()=>{
        for(let attempt=0;attempt<2;attempt++){
          mock.attempts++;
          const staged:Write[]=[];
          const read=(ref:Ref)=>{
            if(staged.length)throw new Error("Read after write");
            mock.reads++;
            return {exists:mock.records.has(ref.path),data:()=>mock.records.get(ref.path)};
          };
          const result=await run({
            get:async(ref:Ref)=>read(ref),getAll:async(...refs:Ref[])=>refs.map(read),
            create:(ref:Ref,data:Record<string,unknown>)=>staged.push({ref,data,create:true}),
            set:(ref:Ref,data:Record<string,unknown>)=>staged.push({ref,data,create:false}),
          });
          if(mock.failOnce){mock.failOnce=false;throw new Error("Simulated commit failure");}
          if(mock.rollbackOnce){mock.rollbackOnce=false;continue;}
          for(const write of staged)if(write.create&&mock.records.has(write.ref.path))throw new Error("Duplicate create");
          for(const write of staged)mock.records.set(write.ref.path,write.data);
          mock.writes+=staged.length;
          return result;
        }
        throw new Error("Retry exhausted");
      });
      mock.tail=operation.catch(()=>undefined);
      return operation;
    },
  }),
}));
const output=process.env.SHUTTLE_BENCHMARK_OUTPUT;
const start=Date.parse("2026-11-03T08:00:00+09:00"),frames=4800,step=7500;
function points(count:number,at:number):PilotObservation[]{
  return Array.from({length:count},(_,i)=>({
    vehicleKey:"benchmark-"+i,routeId:1,status:2,pattern:"benchmark",
    lat:shuttlePlaces.hwarang5.point[0],lon:shuttlePlaces.hwarang5.point[1],
    observedAt:at,measuredAt:at,measurementSource:"receiver",
  }));
}
async function workers(count:number){
  mock.records.clear();mock.reads=0;mock.writes=0;mock.attempts=0;
  mock.rollbackOnce=false;mock.failOnce=false;mock.tail=Promise.resolve();
  const list=[];
  for(let i=0;i<count;i++){vi.resetModules();list.push((await import("./shuttle-pilot-store")).savePilotSample);}
  return list;
}
function counts(){return {reads:mock.reads,writes:mock.writes,attempts:mock.attempts};}
function delta(before:ReturnType<typeof counts>){
  const after=counts();return {reads:after.reads-before.reads,writes:after.writes-before.writes,attempts:after.attempts-before.attempts};
}
afterEach(()=>vi.useRealTimers());

it.skipIf(!output)("measures ten-hour collection capacity with isolated mocked storage",async()=>{
  vi.useFakeTimers({toFake:["Date"]});const began=performance.now(),capacity=[];
  for(const vehicles of [1,2,3])for(const instances of [1,10]){
    const callers=await workers(instances);
    const before=performance.now();
    for(let frame=0;frame<frames;frame++){
      const at=start+frame*step;vi.setSystemTime(at);
      expect(await callers[0](points(vehicles,at),at,()=>undefined)).toBe("saved");
      // Other instances receive the same five-second frame after its first commit.
      for(const caller of callers.slice(1))expect(await caller(points(vehicles,at+100),at+100,()=>undefined)).toBe("duplicate");
    }
    const result={vehicles,instances,frames,...counts(),durationMs:Math.round(performance.now()-before)};
    expect(result.writes).toBe(frames*2);
    expect(result.reads).toBe(frames*(2+instances-1)+vehicles+1);
    expect([...mock.records.keys()].filter(key=>key.startsWith("shuttle_pilot_receipts/"))).toHaveLength(frames);
    capacity.push(result);
  }
  const [same]=await workers(1);
  for(let frame=0;frame<frames;frame++){
    const at=start+frame*step;vi.setSystemTime(at);
    await same(points(2,at),at,()=>undefined);
    for(let viewer=1;viewer<10;viewer++)expect(await same(points(2,at),at,()=>undefined)).toBe("duplicate");
  }
  const sharedInstance={vehicles:2,viewers:10,frames,...counts()};
  expect(sharedInstance.reads).toBe(9603);expect(sharedInstance.writes).toBe(9600);

  const [empty]=await workers(1);vi.setSystemTime(start);await empty(points(2,start),start,()=>undefined);
  let before=counts();vi.setSystemTime(start+step);await empty([],start+step,()=>undefined);
  const firstEmpty=delta(before);expect(firstEmpty).toMatchObject({reads:2,writes:2});
  before=counts();
  for(let frame=2;frame<4802;frame++){const at=start+frame*step;vi.setSystemTime(at);await empty([],at,()=>undefined);}
  const continuedEmpty=delta(before);expect(continuedEmpty).toMatchObject({reads:4800,writes:0});

  const retryWorkers=await workers(10);vi.setSystemTime(start);mock.rollbackOnce=true;
  const concurrent=await Promise.all(retryWorkers.map(caller=>caller(points(2,start),start,()=>undefined)));
  const retriedConcurrent=counts();expect(concurrent.filter(result=>result==="saved")).toHaveLength(1);
  expect(retriedConcurrent).toMatchObject({reads:19,writes:2,attempts:11});
  expect(mock.records.size).toBe(2);

  const [failure]=await workers(1);vi.setSystemTime(start);mock.failOnce=true;
  await expect(failure(points(2,start),start,()=>undefined)).rejects.toThrow("Simulated commit failure");
  const failed=counts();expect(mock.records.size).toBe(0);expect(failed.writes).toBe(0);
  before=counts();await failure(points(2,start),start,()=>undefined);const recovered=delta(before);
  expect(recovered).toMatchObject({reads:5,writes:2,attempts:1});

  const [field]=await workers(1);vi.setSystemTime(start);await field(points(1,start),start,()=>undefined);
  before=counts();
  await field(points(1,start),start,()=>undefined,{vehicleId:"fixture-only",vehicleKey:"benchmark-0",visitId:"hwarangdae-5-campus",event:"pass",observedAt:start+1000});
  const fieldPass=delta(before);expect(fieldPass).toMatchObject({reads:3,writes:2});
  before=counts();
  await field(points(1,start),start,()=>undefined,{vehicleId:"fixture-only",vehicleKey:"benchmark-0",visitId:"hwarangdae-5-campus",event:"arrival",observedAt:start+1000});
  const fieldArrival=delta(before);expect(fieldArrival).toMatchObject({reads:3,writes:2});
  before=counts();
  await field(points(1,start),start,()=>undefined,{vehicleId:"fixture-only",vehicleKey:"benchmark-0",visitId:"hwarangdae-5-campus",event:"departure",observedAt:start+2000});
  const fieldDeparture=delta(before);expect(fieldDeparture).toMatchObject({reads:3,writes:3});

  const report={
    mode:"mock transaction document operations; no Firebase connection",
    assumptions:{hours:10,frames,intervalMs:step,source:"stationary synthetic vehicles",sampling:"one accepted frame per five-second window",transactions:"serialized lock holders; forced retry rolls back staged writes"},
    capacity,sharedInstance,firstEmpty,continuedEmpty,retriedConcurrent,failed,recovered,fieldPass,fieldArrival,fieldDeparture,
    etaAnalytic:{perInstanceCurrentReads:frames,historyReadsWithHourlyExpiry:10,historyReadsAtColdStart:1,modelReadsWithCurrentProfiles:0,extraSelectedVehicleReadsWhenSnapshotCached:0,
      note:"ETA figures are analytical and separate from measured collection operations. Per-process caches do not share reads across instances."},
    limits:["Model-change writes are absent in stationary capacity cases; learned model and operator reports add writes.","Cloud network latency, distributed contention and billed operation counts are unmeasured.","The collector window function is stubbed open for a ten-hour storage capacity run."],
    durationMs:Math.round(performance.now()-began),
  };
  mkdirSync(path.dirname(output!),{recursive:true});writeFileSync(output!,JSON.stringify(report,null,2));
  console.info("Collection benchmark written",report.durationMs,"ms");
},60000);
