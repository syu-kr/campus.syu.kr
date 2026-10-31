import { describe, expect, it } from "vitest";
import { arrivalTimes, getPreviewEta, getStopArrival, hwarangdaeOutbound, initialElapsed, journeyStops, positionOnRoute, previewDepartures, previewRoutes, previewRuns } from "./preview-data";

const seokgye = previewRoutes.find(route => route.id === "seokgye")!;
const hwarangdae = previewRoutes.find(route => route.id === "hwarangdae")!;
const byeollae = previewRoutes.find(route => route.id === "byeollae")!;
describe("shuttle preview fixtures",()=>{
  it("keeps the requested route order",()=>{
    expect(previewRoutes.map(route=>route.id)).toEqual(["hwarangdae","seokgye","byeollae"]);
  });
  it("uses the next known vehicle after a stop is passed and never fabricates one",()=>{
    expect(getStopArrival(seokgye,120,0,"normal",previewRuns(seokgye,"regular",true))).toMatchObject({vehicleId:"preview-bus-b",seconds:1680,scheduled:true});
    expect(getStopArrival(seokgye,120,0,"normal",previewRuns(seokgye,"regular",false))).toMatchObject({state:"passed",seconds:null,vehicleId:null});
    expect(getStopArrival(seokgye,99999,0,"normal",previewRuns(seokgye,"regular",true)).state).toBe("passed");
    expect(getStopArrival(seokgye,250,1,"normal",previewRuns(seokgye,"regular",true))).toMatchObject({state:"arrived",vehicleId:"preview-bus-a"});
  });
  it("selects by actual arrival order and withholds estimates on stale GPS",()=>{
    const runs: import("./preview-data").PreviewRun[]=[{runId:"later",vehicleId:"preview-bus-j",departure:1800},{runId:"earlier",vehicleId:"preview-bus-a",departure:900}];
    expect(getStopArrival(seokgye,120,0,"normal",runs).runId).toBe("earlier");
    expect(getStopArrival(seokgye,120,0,"delayed",runs)).toMatchObject({state:"delayed",seconds:null,vehicleId:null});
  });
  it("uses separate special route/day departures for the next vehicle",()=>{
    expect(previewDepartures(seokgye,"regular")).not.toEqual(previewDepartures(seokgye,"special"));
    expect(previewDepartures(seokgye,"special",true)).not.toEqual(previewDepartures(seokgye,"special",false));
    expect(previewRuns(seokgye,"special",true)[1].departure).toBe(2700);
    expect(previewDepartures(hwarangdae,"special")).not.toEqual(previewDepartures(seokgye,"special"));
  });
  it("counts intermediate dwell once and excludes the destination dwell",()=>{
    expect(getPreviewEta(seokgye,120,3,"normal").seconds).toBe(370);
    expect(getPreviewEta(seokgye,250,2,"normal").seconds).toBe(100);
  });
  it("withholds arrivals for stale or ended service",()=>{
    expect(getPreviewEta(seokgye,120,3,"delayed")).toEqual({state:"delayed",seconds:null});
    expect(getPreviewEta(seokgye,120,3,"ended")).toEqual({state:"ended",seconds:null});
  });
  it("keeps a stop as arrived while dwelling and never invents the next loop",()=>{
    expect(getPreviewEta(seokgye,250,1,"normal").state).toBe("arrived");
    expect(getPreviewEta(seokgye,300,1,"normal").state).toBe("passed");
  });
  it("keeps detour control points separate from stop visits and return paths",()=>{
    const route=hwarangdae;
    expect(route.stops.map(stop=>stop.name)).toEqual(["hwarangdae","school"]);
    expect(route.oneWay).toBe(true);
    expect(hwarangdaeOutbound.legs[0].detour).toBe(true);
    expect(arrivalTimes(route).at(-1)).toBe(360);
    expect(arrivalTimes(hwarangdaeOutbound).at(-1)).toBe(540);
    expect(hwarangdaeOutbound.legs[0].path).not.toEqual([...route.legs[0].path].reverse());
    expect(getPreviewEta(route,initialElapsed(route),0,"normal").seconds).toBe(120);
  });
  it("partitions loop visits by boarding direction without mixing opposite exits",()=>{
    expect(journeyStops(seokgye,"campus")).toEqual([3,4,5]);
    expect(journeyStops(seokgye,"station")).toEqual([0,1,2,3]);
    expect(journeyStops(byeollae,"campus")).toEqual([1,2]);
    expect(journeyStops(byeollae,"station")).toEqual([0,1]);
    expect(journeyStops(hwarangdae,"campus")).toEqual([0,1]);
  });
  it("uses the same trip progression for map positions and stop arrivals",()=>{
    for(const route of previewRoutes){
      const times=arrivalTimes(route);
      times.forEach((time,i)=>expect(positionOnRoute(route,time)).toEqual(route.stops[i].point));
      for(let elapsed=0;elapsed<=times.at(-1)!;elapsed+=30){
        const point=positionOnRoute(route,elapsed);
        expect(point.every(Number.isFinite)).toBe(true);
        route.stops.forEach((_,i)=>{
          const eta=getPreviewEta(route,elapsed,i,"normal");
          if(eta.seconds!==null)expect(eta.seconds).toBeGreaterThan(0);
        });
      }
    }
  });
});
