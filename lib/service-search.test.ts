import { expect, it } from "vitest";
import { findServices, hasServiceMatches } from "./service-search";

it("ranks exact service names first and supports Korean and English", () => {
  expect(findServices("시간표")[0].path).toBe("/academic/timetable");
  expect(findServices("Graduation")[0].path).toBe("/academic/graduation");
  expect(hasServiceMatches("    ")).toBe(false);
  expect(findServices("없는서비스999")).toEqual([]);
  expect(findServices("보건")[0].path).toBe("/campus/health-center");
  expect(findServices("알림")[0].path).toBe("/more/privacy");
  expect(findServices("헬스")[0].path).toBe("/campus/gym");
});
it("uses the server-provided availability consistently without reading private client environment variables", () => {
  expect(findServices("룸메이트")).toEqual([]);
  expect(hasServiceMatches("룸메이트", false)).toBe(false);
  expect(findServices("룸메이트", true)[0].path).toBe("/campus/roommates");
  expect(hasServiceMatches("룸메이트", true)).toBe(true);
});

it("finds chapel seats by section-independent service terms without hiding library seats", () => {
  for (const query of ["채플", "채플좌석", "대강당", "대강당 좌석", "chapel", "auditorium"]) {
    expect(findServices(query).some((item) => item.path === "/campus/chapel-seats")).toBe(true);
  }
  for (const query of ["좌석", "seat"]) {
    const paths = findServices(query).map((item) => item.path);
    expect(paths).toContain("/campus/library");
    expect(paths).toContain("/campus/chapel-seats");
  }
});
