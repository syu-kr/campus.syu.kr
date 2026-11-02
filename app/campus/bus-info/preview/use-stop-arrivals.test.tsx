import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { useStopArrivals } from "./use-stop-arrivals";

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
