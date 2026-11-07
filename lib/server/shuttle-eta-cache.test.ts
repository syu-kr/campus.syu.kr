// @vitest-environment node
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {learningArrivals} from "../shuttle-learning";
const mock=vi.hoisted(()=>({get:vi.fn()}));
vi.mock("./firestore",()=>({getFirestore:()=>({collection:()=>({doc:()=>({get:mock.get})})})}));
const t=Date.parse("2026-11-03T15:00:00+09:00");
beforeEach(()=>{vi.resetModules();vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(t);mock.get.mockReset();});
afterEach(()=>vi.useRealTimers());
it("shares a slow in-flight read beyond the cache duration and lets a later field publication win",async()=>{
  const {readShuttleState,publishShuttleState}=await import("./shuttle-eta-cache");
  let resolve!:(value:{data:()=>Record<string,unknown>})=>void;
  mock.get.mockReturnValue(new Promise(done=>{resolve=done;}));
  const state={receivedAt:t,runs:[],profiles:{},pending:[],learned:[],revision:2};
  const first=readShuttleState();
  vi.setSystemTime(t+40000);const second=readShuttleState();
  expect(mock.get).toHaveBeenCalledOnce();
  publishShuttleState(state);
  vi.setSystemTime(t+80000);
  resolve({data:()=>({...state,revision:1,schemaVersion:3})});
  expect((await first)?.revision).toBe(2);expect((await second)?.revision).toBe(2);
  publishShuttleState({...state,revision:1});
  expect((await readShuttleState())?.revision).toBe(2);
});
it("shares current reads for thirty seconds and immediately invalidates them on publication",async()=>{
  const {readShuttleState,publishShuttleState}=await import("./shuttle-eta-cache");
  const state={schemaVersion:3,receivedAt:t,runs:[],profiles:{},pending:[],learned:[],revision:1};
  mock.get.mockResolvedValue({data:()=>state});
  await readShuttleState();vi.setSystemTime(t+29999);await readShuttleState();expect(mock.get).toHaveBeenCalledOnce();
  vi.setSystemTime(t+30000);await readShuttleState();expect(mock.get).toHaveBeenCalledTimes(2);
  publishShuttleState({...state,receivedAt:t+31000,revision:2});
  expect((await readShuttleState())?.receivedAt).toBe(t+31000);expect(mock.get).toHaveBeenCalledTimes(2);
});
it.each([
  {receivedAt:t+15000,revision:1},
  {receivedAt:t,revision:3},
])("keeps a remote state newer than a publication made during the read: %j",async latest=>{
  const {readShuttleState,publishShuttleState}=await import("./shuttle-eta-cache");
  let resolve!:(value:{data:()=>Record<string,unknown>})=>void;
  mock.get.mockReturnValue(new Promise(done=>{resolve=done;}));
  const local={receivedAt:t,runs:[],profiles:{},pending:[],learned:[],revision:2};
  const pending=readShuttleState();
  vi.setSystemTime(t+10000);publishShuttleState(local);
  vi.setSystemTime(t+20000);resolve({data:()=>({...local,...latest,schemaVersion:3})});
  expect(await pending).toMatchObject(latest);
  expect(await readShuttleState()).toMatchObject(latest);
  expect(mock.get).toHaveBeenCalledOnce();
});
it("expires observed numbers at ninety seconds even when the cached document remains available",async()=>{
  const {readShuttleState}=await import("./shuttle-eta-cache");
  mock.get.mockResolvedValue({data:()=>({schemaVersion:3,receivedAt:t,profiles:{},pending:[],learned:[],runs:[{
    vehicleKey:"cache-test",runId:"cache-run",routeId:2,status:2,pattern:"regular",measuredAt:t,observedAt:t,
    measurementSource:"receiver",lat:37.6,lon:127.1,leg:3,fraction:.5,paceSeconds:null,stationary:false,
  }]})});
  vi.setSystemTime(t+85000);const state=await readShuttleState();
  expect(learningArrivals(state,{}, {2:[]},Date.now()).length).toBeGreaterThan(0);
  vi.setSystemTime(t+90000);const cached=await readShuttleState();expect(mock.get).toHaveBeenCalledOnce();
  expect(learningArrivals(cached,{}, {2:[]},Date.now())).toEqual([]);
});
it("evicts failed reads so a retry can recover immediately",async()=>{
  const {readShuttleState}=await import("./shuttle-eta-cache");
  mock.get.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({data:()=>undefined});
  await expect(readShuttleState()).rejects.toThrow("offline");
  expect(await readShuttleState()).toBeUndefined();expect(mock.get).toHaveBeenCalledTimes(2);
});
