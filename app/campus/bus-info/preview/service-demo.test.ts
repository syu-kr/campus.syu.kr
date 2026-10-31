import { expect, it } from "vitest";
import { demoEventTime, demoLocations, demoStopArrival } from "./service-demo";
import { serviceRoutes } from "./service-data";
const [hwarangdae,seokgye,byeollae]=serviceRoutes;
it("models distinct visit arrivals and follows the same next trip through the destination",()=>{
  expect(demoStopArrival(seokgye,0,3,true)).toMatchObject({state:"approaching",seconds:360,run:0});
  expect(demoStopArrival(seokgye,0,4,true).seconds).toBe(540);
  const elapsed=demoEventTime(seokgye,3,true),next=demoStopArrival(seokgye,elapsed,3,true);
  expect(next.run).toBe(1);
  expect(demoStopArrival(seokgye,elapsed,5,true,false,next.run! ).seconds).toBeGreaterThan(demoStopArrival(seokgye,elapsed,5,true).seconds!);
  expect(demoStopArrival(seokgye,elapsed,3,false).state).toBe("passed");
  expect(demoStopArrival(seokgye,5000,3,true).state).toBe("passed");
});
it("keeps origin arrival and departure waiting distinct and hides forecasts on delay",()=>{
  const origin=demoEventTime(hwarangdae,0);
  expect(demoStopArrival(hwarangdae,origin-180,0,true)).toMatchObject({state:"approaching",seconds:180});
  expect(demoLocations(hwarangdae,origin-180,true)).toEqual([]);
  expect(demoStopArrival(hwarangdae,origin,0,true)).toMatchObject({state:"waiting",seconds:120});
  expect(demoLocations(hwarangdae,origin,true)).toHaveLength(1);
  expect(demoStopArrival(hwarangdae,origin+121,0,true)).toMatchObject({state:"approaching",run:1});
  expect(demoStopArrival(hwarangdae,origin+121,0,false)).toMatchObject({state:"passed"});
  expect(demoStopArrival(byeollae,0,1,true).seconds).toBe(360);
  expect(demoStopArrival(seokgye,0,3,true,true)).toMatchObject({state:"delayed",seconds:null});
});
it("uses stable sample vehicle identities and removes completed trips without changing route geometry",()=>{
  const before=JSON.stringify(serviceRoutes);
  expect(demoLocations(seokgye,0,true)[0].id).toBe(demoLocations(seokgye,100,true)[0].id);
  expect(demoLocations(seokgye,5000,true)).toEqual([]);
  expect(serviceRoutes.every(route=>route.legs.length===0)).toBe(true);
  expect(JSON.stringify(serviceRoutes)).toBe(before);
});
