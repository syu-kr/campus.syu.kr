import { describe, expect, it } from "vitest";
import { advancePilotObservation, pilotVisits, type PilotObservation } from "./shuttle-observations";
import { shuttlePlaces } from "./shuttle-visits";

const time = Date.parse("2026-11-02T08:50:00+09:00");
const point = (offset: number, at: readonly [number, number] = shuttlePlaces.hwarang5.point): PilotObservation => ({
  vehicleKey:"daily-test-key",routeId:1,status:2,pattern:"mondayToThursday:online",lat:at[0],lon:at[1],
  observedAt:time+offset,measuredAt:time+offset,measurementSource:"receiver",
});
describe("pilot observation history", () => {
  it("keeps one run from observed origin to destination and records bounded candidate events", () => {
    const origin=advancePilotObservation(undefined,point(0));
    const moving=advancePilotObservation(origin.state,point(30_000,[37.63,127.095]));
    const arrived=advancePilotObservation(moving.state,point(60_000,shuttlePlaces.school.point));
    expect(moving.state.runId).toBe(origin.state.runId);
    expect(arrived.state.runId).toBe(origin.state.runId);
    expect(arrived.state.originObserved).toBe(true);
    expect(moving.events).toEqual([expect.objectContaining({event:"departure",visitId:"hwarangdae-5-campus",windowStart:time,windowEnd:time+30_000,validation:"candidate"})]);
    expect(arrived.events).toEqual([expect.objectContaining({event:"arrival",visitId:"hwarangdae-campus-arrival",windowStart:time+30_000,windowEnd:time+60_000,method:"receiver-geofence"})]);
  });
  it("does not fabricate a crossing when recording starts at a stop", () => {
    const result=advancePilotObservation(undefined,point(0));
    expect(result.events[0].windowStart).toBeNull();
    expect(result.events[0].validation).toBe("candidate");
  });
  it("retains stop occupancy between the entry and exit radii", () => {
    const start=advancePilotObservation(undefined,point(0));
    const edge=advancePilotObservation(start.state,point(30_000,[shuttlePlaces.hwarang5.point[0]+0.0008,shuttlePlaces.hwarang5.point[1]]));
    expect(edge.events).toEqual([]);
    expect(edge.state.stopId).toBe(start.state.stopId);
  });
  it.each(["gap","direction","pattern","route","day"])("starts a separate run across %s", mode => {
    const first=advancePilotObservation(undefined,point(0));
    const next=point(mode==="gap"?180_000:30_000,[37.63,127.095]);
    if(mode==="direction")next.status=1;
    if(mode==="pattern")next.pattern="different-service";
    if(mode==="route")next.routeId=2;
    if(mode==="day"){next.observedAt+=86400_000;next.measuredAt+=86400_000;}
    const result=advancePilotObservation(first.state,next);
    expect(result.state.runId).not.toBe(first.state.runId);
    expect(result.state.originObserved).toBe(false);
    expect(result.events).toEqual([]);
  });
  it("cannot move the cursor backwards or replay a duplicate", () => {
    const first=advancePilotObservation(undefined,point(30_000));
    for(const offset of [0,30_000]){
      const result=advancePilotObservation(first.state,point(offset,[37.63,127.095]));
      expect(result).toMatchObject({state:first.state,events:[],advanced:false});
    }
  });
  it("does not treat re-received device measurements as new movement", () => {
    const first=advancePilotObservation(undefined,{...point(0),measurementSource:"source"});
    const result=advancePilotObservation(first.state,{...point(30_000,[37.63,127.095]),measurementSource:"source",measuredAt:time});
    expect(result.advanced).toBe(false);
    expect(result.events).toEqual([]);
  });
  it("starts a new run when the same direction returns to its origin", () => {
    const first=advancePilotObservation(undefined,point(0));
    const terminal=advancePilotObservation(first.state,point(60_000,shuttlePlaces.school.point));
    const next=advancePilotObservation(terminal.state,point(120_000));
    expect(next.state.runId).not.toBe(first.state.runId);
    expect(next.events[0].windowStart).toBeNull();
  });
  it("keeps overlapping station exits and return movements in their own directions", () => {
    expect(pilotVisits(2,1).map(v=>v.id)).toContain("seokgye-taereung-6");
    expect(pilotVisits(2,2).map(v=>v.id)).not.toContain("seokgye-taereung-6");
    expect(pilotVisits(2,2).map(v=>v.id)).toContain("seokgye-taereung-7");
    expect(pilotVisits(1,1)[0].id).toBe("hwarangdae-return-campus");
  });
});
