import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { useStopArrivals } from "./use-stop-arrivals";
import { parseEtaResponse } from "./eta-response";

afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it("isolates vehicle caches and removes expired numbers between network polls",async()=>{
  const t=Date.parse("2026-11-03T15:00:00+09:00"),target="seokgye-taereung-7";
  const fetch=vi.fn(async(url:string)=>Response.json({status:"active",arrivals:[{
    visitId:target,measuredAt:t,validUntil:t+90_000,arrivalAt:t+(url.includes("test-A")?6:2)*60_000,
  }]}));vi.stubGlobal("fetch",fetch);
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
  const wrapper=({children}:{children:ReactNode})=><QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const {result,rerender,unmount}=renderHook(({vehicleId,at,enabled})=>useStopArrivals(new Date(at),enabled,vehicleId),{
    wrapper,initialProps:{vehicleId:"test-A",at:t,enabled:true},
  });
  await waitFor(()=>expect(result.current.minutes.get(target)).toBe(6));
  rerender({vehicleId:"test-B",at:t,enabled:true});expect(result.current.minutes.get(target)).not.toBe(6);
  await waitFor(()=>expect(result.current.minutes.get(target)).toBe(2));
  expect(fetch.mock.calls.map(call=>call[0])).toEqual([
    "/campus/bus-info/preview/eta?vehicleId=test-A","/campus/bus-info/preview/eta?vehicleId=test-B",
  ]);
  act(()=>rerender({vehicleId:"test-B",at:t+90_000,enabled:true}));expect(result.current.minutes.size).toBe(0);
  rerender({vehicleId:"test-B",at:t,enabled:false});expect(result.current.minutes.size).toBe(0);
  unmount();client.clear();
});
it("retains valid observed and scheduled values after a refetch error, then expires them independently",async()=>{
  const t=Date.parse("2026-11-03T15:00:00+09:00"),visitId="seokgye-taereung-7";
  const payload={status:"learning",arrivals:[{visitId,arrivalAt:t+600000,measuredAt:t,validUntil:t+90000}],
    scheduledArrivals:[{visitId,departureAt:t,arrivalAt:t+600000,travelSeconds:600}],
    context:{serviceDate:"2026-11-03",version:"v1",generatedAt:t,validUntil:t+300000}};
  const fetch=vi.fn().mockResolvedValueOnce(Response.json(payload)).mockRejectedValueOnce(new Error("offline"));
  vi.stubGlobal("fetch",fetch);
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
  const wrapper=({children}:{children:ReactNode})=><QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const {result,rerender,unmount}=renderHook(({at,version})=>useStopArrivals(new Date(at),true,undefined,false,undefined,version),{wrapper,initialProps:{at:t,version:"v1"}});
  try {
    await waitFor(()=>expect(result.current.minutes.get(visitId)).toBe(10));
    await act(async()=>{await client.refetchQueries({queryKey:["shuttle-stop-arrivals"]});});
    await waitFor(()=>expect(result.current.status).toBe("error"));
    expect(result.current.scheduled.size).toBe(1);expect(result.current.observations.size).toBe(1);
    rerender({at:t+90000,version:"v1"});
    expect(result.current.minutes.size).toBe(0);expect(result.current.scheduled.size).toBe(1);
    rerender({at:t+300000,version:"v1"});expect(result.current.scheduled.size).toBe(0);
  } finally {unmount();client.clear();}
});
it("discards cached forecasts on an authoritative empty response and isolates a new timetable version",async()=>{
  const t=Date.parse("2026-11-03T15:00:00+09:00"),visitId="seokgye-taereung-7";
  const context={serviceDate:"2026-11-03",version:"v1",generatedAt:t,validUntil:t+300000};
  const fetch=vi.fn().mockResolvedValueOnce(Response.json({status:"learning",arrivals:[],context,scheduledArrivals:[{visitId,departureAt:t,arrivalAt:t+600000,travelSeconds:600}]}))
    .mockImplementation(async()=>Response.json({status:"learning",arrivals:[],context,scheduledArrivals:[]}));
  vi.stubGlobal("fetch",fetch);
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
  const wrapper=({children}:{children:ReactNode})=><QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const {result,rerender,unmount}=renderHook(({version})=>useStopArrivals(new Date(t),true,undefined,false,undefined,version),{wrapper,initialProps:{version:"v1"}});
  try {
    await waitFor(()=>expect(result.current.scheduled.size).toBe(1));
    await act(async()=>{await client.refetchQueries({queryKey:["shuttle-stop-arrivals"]});});
    await waitFor(()=>expect(result.current.scheduled.size).toBe(0));
    rerender({version:"v2"});
    await waitFor(()=>expect(result.current.versionMismatch).toBe(true));
    expect(result.current.scheduled.size).toBe(0);
  } finally {unmount();client.clear();}
});
it("rejects malformed timing and mixed-order trip payloads at the response boundary",()=>{
  expect(parseEtaResponse({status:"unavailable",arrivals:[{arrivalAt:123}]})).toMatchObject({arrivals:[],scheduledArrivals:[],trips:[]});
  expect(parseEtaResponse({status:"learning",arrivals:[],context:{serviceDate:"2026-11-03",version:"v1",
    generatedAt:Date.parse("2026-11-03T15:00:00+09:00"),validUntil:Date.parse("2026-11-03T14:59:59+09:00")}}).arrivals).toEqual([]);
  expect(()=>parseEtaResponse({status:"learning",arrivals:[{visitId:"seokgye-4",arrivalAt:NaN,measuredAt:1,validUntil:2}]})).toThrow();
  expect(()=>parseEtaResponse({status:"learning",arrivals:[],trips:[{key:"x",route:"hwarangdae",pattern:"p",departureAt:1,stops:[
    {visitId:"hwarangdae-campus-arrival",departureAt:1,arrivalAt:2,travelSeconds:1},
  ]}]})).toThrow();
});
it("keeps a closed-window scheduled response for an hour without a polling request, then resumes at opening",async()=>{
  vi.useFakeTimers();
  const t=Date.parse("2026-11-03T07:00:00+09:00");
  const fetch=vi.fn(async()=>Response.json({status:"learning",arrivals:[],scheduledArrivals:[]}));
  vi.stubGlobal("fetch",fetch);
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
  const wrapper=({children}:{children:ReactNode})=><QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const {rerender,unmount}=renderHook(({polling})=>useStopArrivals(new Date(t),true,undefined,polling),{wrapper,initialProps:{polling:false}});
  await act(async()=>{await vi.advanceTimersByTimeAsync(1);});
  expect(fetch).toHaveBeenCalledTimes(1);
  await act(async()=>{await vi.advanceTimersByTimeAsync(3600000);});
  expect(fetch).toHaveBeenCalledTimes(1);
  rerender({polling:true});
  await act(async()=>{await vi.advanceTimersByTimeAsync(10100);});
  expect(fetch.mock.calls.length).toBeGreaterThan(1);
  unmount();client.clear();
});
it("takes one final forecast at collection closure and stops repeating requests afterwards",async()=>{
  vi.useFakeTimers();
  const t=Date.parse("2026-11-03T18:45:00+09:00"),visitId="seokgye-campus-arrival";
  const dayEnd=Date.parse("2026-11-04T00:00:00+09:00");
  const fetch=vi.fn(async()=>Response.json({status:"learning",arrivals:[],scheduledArrivals:[{
    visitId,departureAt:t-30*60000,arrivalAt:t+60000,travelSeconds:1860,
  }],context:{serviceDate:"2026-11-03",version:"v1",generatedAt:t,validUntil:fetch.mock.calls.length===1?t+300000:dayEnd}}));
  vi.stubGlobal("fetch",fetch);
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
  const wrapper=({children}:{children:ReactNode})=><QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const {result,rerender,unmount}=renderHook(({polling,at})=>useStopArrivals(new Date(at),true,undefined,polling),{wrapper,initialProps:{polling:true,at:t}});
  try{
    await act(async()=>{await vi.advanceTimersByTimeAsync(1);});
    expect(fetch).toHaveBeenCalledTimes(1);
    rerender({polling:false,at:t});
    await act(async()=>{await vi.advanceTimersByTimeAsync(1);});
    expect(fetch).toHaveBeenCalledTimes(2);expect(result.current.context?.validUntil).toBe(dayEnd);
    await act(async()=>{await vi.advanceTimersByTimeAsync(3600000);});
    rerender({polling:false,at:t+3600000});
    expect(fetch).toHaveBeenCalledTimes(2);expect(result.current.scheduled.size).toBe(1);
  }finally{unmount();client.clear();}
});
