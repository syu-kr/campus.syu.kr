import { describe, expect, it } from "vitest";
import { toBusLocation } from "./shuttle-location";

describe("toBusLocation", () => {
  it("preserves an explicit source measurement time and rejects ambiguous or future times", () => {
    const input={id:"bus",name:"bus",lat:37.64,lon:127.1,status:2,routeid:1};
    const measuredAt=Date.now()-1000;
    expect(toBusLocation({...input,measuredAt})?.measuredAt).toBe(measuredAt);
    expect(toBusLocation({...input,measuredAt:new Date(measuredAt).toISOString()})?.measuredAt).toBe(measuredAt);
    for(const value of ["12:30", "2026-01-01T12:30:00", Date.now()+60_000, NaN, -1]){
      expect(toBusLocation({...input,measuredAt:value})).not.toHaveProperty("measuredAt");
    }
  });
  it("normalizes a valid shuttle location", () => {
    expect(
      toBusLocation({
        id: "bus_1",
        name: "1호차",
        lat: "37.6428",
        lon: "127.1084",
        status: "1",
        routeid: "2",
      }),
    ).toEqual({
      id: "bus_1",
      name: "1호차",
      lat: "37.6428",
      lon: "127.1084",
      status: 1,
      routeid: 2,
    });
  });

  it.each([
    { lat: "91", lon: "127", status: 1, routeid: 1 },
    { lat: "37", lon: "181", status: 1, routeid: 1 },
    { lat: "37", lon: "127", status: 3, routeid: 1 },
    { lat: "37", lon: "127", status: 1, routeid: 5 },
  ])("rejects an invalid coordinate or enum value", (invalidValues) => {
    expect(
      toBusLocation({
        id: "bus_1",
        name: "1호차",
        ...invalidValues,
      }),
    ).toBeNull();
  });
});
