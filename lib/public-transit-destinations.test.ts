import { describe, expect, it } from "vitest";
import { getBusRouteDestination } from "./public-transit-destinations";

describe("public transit route destinations", () => {
  it.each([
    ["jungmun-up", "100100039", "불암동 방면"],
    ["jungmun-down", "100100039", "후암동 방면"],
    ["humun-up", "100100166", "불암동 방면"],
    ["humun-down", "100100166", "서일대학교 방면"],
    ["jungmun-up", "110000009", "불암동 방면"],
    ["jungmun-down", "110000009", "석계역 방면"],
    ["jungmun-up", "222000008", "청학리 방면"],
    ["humun-down", "222000008", "석계역 방면"],
    ["jungmun-up", "222000222", "사능차고지 방면"],
    ["jungmun-down", "222000222", "석계역 방면"],
    ["jungmun-up", "241339004", "구리역·롯데백화점 방면"],
    ["jungmun-down", "241339004", "삼육대앞 종점"],
    ["humun-up", "241347005", "부대앞 방면"],
    ["jungmun-down", "241347005", "태릉입구역 방면"],
    ["jungmun-up", "241347006", "별내차고지 방면"],
    ["humun-down", "241347006", "태릉입구역 방면"],
    ["humun-up", "241347011", "별내차고지 방면"],
    ["humun-down", "241347011", "삼육대후문 종점"],
  ])(
    "resolves %s / %s to an independently verified destination",
    (stopId, routeId, expectedLabel) => {
      expect(getBusRouteDestination(stopId, routeId)?.labelKo).toBe(
        expectedLabel,
      );
    },
  );

  it("does not guess a destination for an unknown route", () => {
    expect(
      getBusRouteDestination("jungmun-up", "unknown-route"),
    ).toBeUndefined();
  });

  it("does not reuse a destination at a stop the route does not serve", () => {
    expect(
      getBusRouteDestination("humun-up", "241339004"),
    ).toBeUndefined();
  });
});
