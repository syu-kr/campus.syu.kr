import { describe, expect, it } from "vitest";
import { resolveTransitTimestamp } from "@/lib/server/transit-cache";
import {
  getBusRouteKey,
  readTransitNumber,
} from "@/lib/public-transit";

describe("resolveTransitTimestamp", () => {
  const cachedTimestamp = "2026-07-13T01:00:00.000Z";
  const currentTimestamp = "2026-07-13T01:01:00.000Z";

  it("keeps the cached timestamp when a cached route is preserved", () => {
    expect(
      resolveTransitTimestamp(true, cachedTimestamp, currentTimestamp),
    ).toBe(cachedTimestamp);
  });

  it("uses the current timestamp for fully fresh data", () => {
    expect(
      resolveTransitTimestamp(false, cachedTimestamp, currentTimestamp),
    ).toBe(currentTimestamp);
  });
});

describe("public transit provider normalization", () => {
  it("uses routeId to merge provider-specific route names", () => {
    expect(
      getBusRouteKey({ routeId: "241339004", routeName: "구리2-2" }),
    ).toBe(getBusRouteKey({ routeId: "241339004", routeName: "2-2" }));
  });

  it("omits empty numeric fields instead of returning empty strings", () => {
    expect(readTransitNumber("")).toBeUndefined();
    expect(readTransitNumber("  ")).toBeUndefined();
    expect(readTransitNumber("12")).toBe(12);
    expect(readTransitNumber(7)).toBe(7);
  });
});
