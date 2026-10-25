import { expect, it } from "vitest";
import { findServices, hasServiceMatches } from "./service-search";

it("ranks exact service names first and supports Korean and English", () => {
  expect(findServices("시간표")[0].path).toBe("/academic/timetable");
  expect(findServices("Graduation")[0].path).toBe("/academic/graduation");
  expect(hasServiceMatches("    ")).toBe(false);
  expect(findServices("없는서비스999")).toEqual([]);
});
it("uses the server-provided availability consistently without reading private client environment variables", () => {
  expect(findServices("룸메이트")).toEqual([]);
  expect(hasServiceMatches("룸메이트", false)).toBe(false);
  expect(findServices("룸메이트", true)[0].path).toBe("/campus/roommates");
  expect(hasServiceMatches("룸메이트", true)).toBe(true);
});
