import { describe, expect, it } from "vitest";
import { resolveTransitTimestamp } from "@/lib/server/transit-cache";
import {
  extractKoreanMinutes,
  fillMissingBusRoutes,
  getBusRouteKey,
  PUBLIC_TRANSIT_STOPS,
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

  it("treats an imminent Seoul arrival as active", () => {
    expect(extractKoreanMinutes("곧 도착")).toBe(1);
    expect(extractKoreanMinutes("5분후[4번째 전]")).toBe(5);
  });

  it("queries both Seoul back-gate stops", () => {
    expect(
      PUBLIC_TRANSIT_STOPS.filter((stop) => stop.id.startsWith("seoul-humun"))
        .map((stop) => stop.seoulArsId),
    ).toEqual(["42100", "42101"]);
  });

  it("keeps the full route roster when no arrival is currently predicted", () => {
    const jungmunUp = fillMissingBusRoutes("jungmun-up", []);
    const jungmunDown = fillMissingBusRoutes("jungmun-down", []);
    const humunUp = fillMissingBusRoutes("humun-up", []);
    const humunDown = fillMissingBusRoutes("humun-down", []);

    expect(jungmunUp.map(({ routeId }) => routeId).sort()).toEqual(
      jungmunDown.map(({ routeId }) => routeId).sort(),
    );
    expect(humunUp.map(({ routeId }) => routeId).sort()).toEqual(
      humunDown.map(({ routeId }) => routeId).sort(),
    );
    expect(jungmunUp).toHaveLength(8);
    expect(humunUp).toHaveLength(6);
    expect(humunUp.every(({ arrivalMsg1 }) => arrivalMsg1 === "정보 없음"))
      .toBe(true);
  });
});
