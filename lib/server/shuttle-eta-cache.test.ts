// @vitest-environment node
import {afterEach,beforeEach,expect,it,vi} from "vitest";
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
  vi.setSystemTime(t+10000);const second=readShuttleState();
  expect(mock.get).toHaveBeenCalledOnce();
  publishShuttleState(state);
  resolve({data:()=>({...state,revision:1,schemaVersion:3})});
  expect((await first)?.revision).toBe(2);expect((await second)?.revision).toBe(2);
  publishShuttleState({...state,revision:1});
  expect((await readShuttleState())?.revision).toBe(2);
});
it("evicts failed reads so a retry can recover immediately",async()=>{
  const {readShuttleState}=await import("./shuttle-eta-cache");
  mock.get.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({data:()=>undefined});
  await expect(readShuttleState()).rejects.toThrow("offline");
  expect(await readShuttleState()).toBeUndefined();expect(mock.get).toHaveBeenCalledTimes(2);
});
