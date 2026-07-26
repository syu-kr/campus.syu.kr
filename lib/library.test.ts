import { describe, expect, it } from "vitest";

import { getLibrarySeason } from "@/lib/library";

const SEMESTER_PERIODS = [
  {
    startDate: "2026-03-03",
    endDate: "2026-06-15",
  },
  {
    startDate: "2026-09-01",
    endDate: "2026-12-14",
  },
];

describe("getLibrarySeason", () => {
  it.each([
    ["2026-03-03", "semester"],
    ["2026-06-15", "semester"],
    ["2026-06-16", "vacation"],
    ["2026-07-26", "vacation"],
    ["2026-09-01", "semester"],
    ["2026-12-14", "semester"],
    ["2026-12-15", "vacation"],
  ] as const)("%s 날짜를 %s으로 판정한다", (dateString, expected) => {
    expect(getLibrarySeason(dateString, SEMESTER_PERIODS)).toBe(expected);
  });

  it("학기 데이터가 없으면 단축 운영인 방학으로 안전하게 판정한다", () => {
    expect(getLibrarySeason("2026-07-26")).toBe("vacation");
  });
});
