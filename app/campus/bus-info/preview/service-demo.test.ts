import { expect, it } from "vitest";
import { demoDepartures, demoEventTime, demoLocations, demoProgress, demoStopArrival } from "./service-demo";
import { serviceRoutes } from "./service-data";
import { testServiceData } from "./service-test-data";
const [hwarangdae,seokgye]=serviceRoutes;
const data={...testServiceData,nowISO:"2026-10-30T11:50:00+09:00"};
const departures=demoDepartures(seokgye,data);

it("uses the actual first departure and headway rather than starting a trip before service",()=>{
  expect(departures.slice(0,2)).toEqual([600,2400]);
  expect(demoLocations(seokgye,0,true,departures)).toEqual([]);
  expect(demoProgress(seokgye,599,true,departures)).toEqual([]);
  expect(demoProgress(seokgye,600,true,departures)[0]).toMatchObject({position:0,run:0});
  expect(demoStopArrival(seokgye,0,3,true,false,undefined,departures)).toMatchObject({state:"approaching",seconds:1260,run:0});
  expect(demoStopArrival(seokgye,0,4,true,false,undefined,departures).seconds).toBe(1440);
});
it("keeps a departed last trip visible until its terminal, without inventing a following bus",()=>{
  const last=demoDepartures(seokgye,{...data,nowISO:"2026-10-30T15:22:00+09:00"});
  expect(last).toEqual([480]);
  expect(demoStopArrival(seokgye,481,0,true,false,undefined,last).state).toBe("passed");
  expect(demoStopArrival(seokgye,481,3,true,false,undefined,last).seconds).toBe(659);
  expect(demoLocations(seokgye,481,true,last)).toHaveLength(1);
  expect(demoLocations(seokgye,1761,true,last)).toEqual([]);
});
it("moves to the actual next departure after a stop passes and respects its checkbox",()=>{
  const passed=demoEventTime(seokgye,3,true,departures);
  expect(passed).toBe(1281);
  expect(demoStopArrival(seokgye,passed,3,true,false,undefined,departures)).toMatchObject({run:1,seconds:1779});
  expect(demoStopArrival(seokgye,passed,3,false,false,undefined,departures).state).toBe("passed");
  expect(demoEventTime(seokgye,3,false,departures,passed)).toBe(3060);
});
it("hides every numeric sample forecast during delay and preserves stable vehicle identities",()=>{
  expect(demoStopArrival(seokgye,700,3,true,true,undefined,departures)).toMatchObject({state:"delayed",seconds:null});
  expect(demoLocations(seokgye,700,true,departures)[0].id).toBe(demoLocations(seokgye,800,true,departures)[0].id);
  expect(demoDepartures(hwarangdae,{...data,nowISO:"2026-10-31T11:50:00+09:00"})).toEqual([]);
});
