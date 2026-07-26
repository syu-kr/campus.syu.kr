import { describe, expect, it } from "vitest";
import { toBusLocation } from "./shuttle-location";

describe("toBusLocation", () => {
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
