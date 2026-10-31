import { expect, it } from "vitest";
import { demoEventTime, demoProgress, demoLocations } from "./service-demo";
import { serviceRoutes, serviceOutboundRoute } from "./service-data";
import { serviceVisits, defaultServiceRoute, serviceRoadPaths, pointAlongPath } from "./service-visits";
const [,route]=serviceRoutes;
it("uses KST noon only for the initial route",()=>{
  expect(defaultServiceRoute(new Date("2026-10-30T02:59:59Z"))).toBe("hwarangdae");
  expect(defaultServiceRoute(new Date("2026-10-30T03:00:00Z"))).toBe("seokgye");
});
it("keeps distinct visit IDs and the confirmed boarding rules for the Seokgye loop",()=>{
  const ids=serviceRoutes.flatMap(r=>serviceVisits[r.id].map(v=>v.id));
  expect(new Set(ids).size).toBe(ids.length);
  expect(serviceVisits.seokgye.map(v=>v.role)).toEqual(["pickup","dropoff","dropoff","both","pickup","dropoff"]);
  expect(serviceVisits.seokgye[0].id).not.toBe(serviceVisits.seokgye.at(-1)!.id);
  const distance=(a:readonly number[],b:readonly number[])=>Math.hypot((a[0]-b[0])*111000,(a[1]-b[1])*88000);
  serviceRoutes.forEach(r=>{expect(serviceVisits[r.id]).toHaveLength(r.stops.length);const paths=serviceRoadPaths(r);expect(paths).toHaveLength(r.stops.length-1);paths.forEach((path,i)=>{expect(path.length).toBeGreaterThan(10);expect(distance(path[0],r.stops[i].point)).toBeLessThan(100);expect(distance(path.at(-1)!,r.stops[i+1].point)).toBeLessThan(100);if(i)expect(distance(paths[i-1].at(-1)!,path[0])).toBeLessThan(2);});});
  expect(serviceRoadPaths({id:"unknown"})).toEqual([]);
});
it("moves monotonically down visits, pauses at stops, and uses the same path for map positions",()=>{
  let previous=-1;
  for(let t=0;t<demoEventTime(route,route.stops.length-1,true);t+=5) {const bus=demoProgress(route,t,false)[0];expect(bus.position).toBeGreaterThanOrEqual(previous);previous=bus.position;const segment=Math.min(route.stops.length-2,Math.floor(bus.position));const point=pointAlongPath(serviceRoadPaths(route)[segment],bus.position-segment);expect(demoLocations(route,t,false)[0].lat).toBe(String(point[0]));}
  const arrive=demoEventTime(route,3);
  expect(demoProgress(route,arrive,false)[0].position).toBe(3);
  expect(demoProgress(route,arrive+15,false)[0].position).toBe(3);
  expect(demoProgress(route,arrive+30,false)[0].position).toBeGreaterThan(3);
  expect(demoProgress(route,5000,true)).toEqual([]);
});
it("keeps the confirmed outbound motorway/Bonghwa detour separate from campus-bound geometry",()=>{
  const path=serviceRoadPaths(serviceOutboundRoute)[0];
  expect(path.length).toBeGreaterThan(100);
  expect(path).not.toEqual([...serviceRoadPaths(serviceRoutes[0])[0]].reverse());
  expect(Math.min(...path.map(p=>p[1]))).toBeGreaterThan(127.08);
  expect(path).toContainEqual([37.616443,127.093447]);
  expect(path).toContainEqual([37.617372,127.092997]);
  const point=pointAlongPath(path,2/3),bus=demoLocations(serviceOutboundRoute,600,false)[0];
  expect([Number(bus.lat),Number(bus.lon)]).toEqual(point);
});
