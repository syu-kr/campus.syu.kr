import { describe, expect, it } from "vitest";
import { getStopArrival, previewRoutes, previewRuns, runningVehicleTrips, type PreviewRun } from "./preview-data";
import { isPreviewVehicleId, previewFleet, vehiclePinSvg } from "./preview-vehicles";

describe("permanent preview fleet", () => {
  it("locks the ten assignments independently of ordering", () => {
    expect(previewFleet).toEqual({
      "preview-bus-a":1,"preview-bus-b":2,"preview-bus-c":3,"preview-bus-d":4,"preview-bus-e":5,
      "preview-bus-f":6,"preview-bus-g":7,"preview-bus-h":8,"preview-bus-i":9,"preview-bus-j":10,
    });
    expect(Object.isFrozen(previewFleet)).toBe(true);
    expect(Reflect.set(previewFleet,"preview-bus-a",10)).toBe(false);
    const reversed=Object.keys(previewFleet).filter(isPreviewVehicleId).reverse();
    expect(reversed.map(id=>previewFleet[id])).toEqual([10,9,8,7,6,5,4,3,2,1]);
  });

  it("keeps vehicle identity across routes, schedules and newly assigned runs", () => {
    const runIds=new Set<string>();
    for(const route of previewRoutes) for(const type of ["regular","special"] as const) {
      const run=previewRuns(route,type,true,"preview-bus-j")[0];
      runIds.add(run.runId);
      expect(run.vehicleId).toBe("preview-bus-j");
      expect(previewFleet[run.vehicleId]).toBe(10);
    }
    expect(runIds.size).toBe(6);
    const runs:PreviewRun[]=[
      {runId:"late",vehicleId:"preview-bus-a",departure:1800},
      {runId:"early",vehicleId:"preview-bus-j",departure:900},
    ];
    const route=previewRoutes[0];
    expect(getStopArrival(route,120,0,"normal",runs)).toEqual(getStopArrival(route,120,0,"normal",[...runs].reverse()));
    expect(getStopArrival(route,120,0,"normal",runs).vehicleId).toBe("preview-bus-j");
  });

  it("draws one moving pin per physical vehicle even when it has multiple run records", () => {
    const route=previewRoutes[0];
    const runs:PreviewRun[]=[
      {runId:"trip-1",vehicleId:"preview-bus-j",departure:0},
      {runId:"trip-2",vehicleId:"preview-bus-j",departure:900},
    ];
    expect(runningVehicleTrips(route,120,runs).map(run=>run.runId)).toEqual(["trip-1"]);
    expect(runningVehicleTrips(route,1020,[...runs].reverse()).map(run=>run.runId)).toEqual(["trip-2"]);
  });

  it("renders route-colored bus icons without public vehicle numbers", () => {
    for(const route of previewRoutes) {
      const svg=vehiclePinSvg(route.color);
      expect(svg).toContain(`fill="${route.color}"`);
      expect(svg).not.toContain("<text");
      expect(svg).toContain('width="40" height="48"');
    }
    expect(vehiclePinSvg(previewRoutes[0].color,true)).toContain('fill="#6b7280"');
    expect(vehiclePinSvg("#10b981")).toContain('rx="4" fill="#173247"');
    expect(vehiclePinSvg("#f59e0b")).toContain('rx="4" fill="#173247"');
  });

  it("rejects unknown internal vehicle IDs", () => {
    expect(isPreviewVehicleId("__proto__")).toBe(false);
    expect(isPreviewVehicleId("constructor")).toBe(false);
    expect(isPreviewVehicleId("preview-bus-k")).toBe(false);
    expect(isPreviewVehicleId(null)).toBe(false);
  });
});
