import { describe, expect, it } from "vitest";
import { defaultRecruitDeadline, matchesRoommateFilters, normalizeRoommateHabits, normalizeRoommatePostInput, parseRoommateFilters, recruitDeadlineMillis } from "@/lib/roommates";
import type { RoommatePostInput } from "@/types/roommates";

const now = Date.parse("2026-10-04T06:00:00Z");
const input: RoommatePostInput = { nickname: "삼육학생", dorm: "eden", roomSize: 3, stayStart: "2026-10-04", stayEnd: "2026-12-20", roommatesNeeded: 2, recruitUntil: "2026-11-02", habits: {}, description: "함께 지낼 분", openChatUrl: "https://open.kakao.com/o/aB123" };

describe("roommate input validation", () => {
  it("uses KST calendar dates and inclusive 30-day recruiting windows", () => {
    expect(defaultRecruitDeadline(input.stayEnd, now)).toBe("2026-11-02");
    expect(recruitDeadlineMillis("2026-11-02")).toBe(Date.parse("2026-11-02T15:00:00Z"));
    expect(normalizeRoommatePostInput(input, { now }).roommatesNeeded).toBe(2);
    expect(() => normalizeRoommatePostInput({ ...input, recruitUntil: "2026-11-03" }, { now })).toThrow();
    expect(() => normalizeRoommatePostInput({ ...input, stayStart: "2026-02-30" }, { now })).toThrow();
    expect(() => normalizeRoommatePostInput({ ...input, stayEnd: "2026-10-03" }, { now })).toThrow();
  });

  it("rejects invalid rooms, capacities, unexpected fields and deadline extensions", () => {
    expect(() => normalizeRoommatePostInput({ ...input, dorm: "peniel", roomSize: 3 }, { now })).toThrow();
    expect(() => normalizeRoommatePostInput({ ...input, roommatesNeeded: 3 }, { now })).toThrow();
    expect(() => normalizeRoommatePostInput({ ...input, ownerKey: "victim" }, { now })).toThrow();
    expect(() => normalizeRoommatePostInput(input, { now, previousDeadline: "2026-10-20" })).toThrow();
  });

  it.each([
    "https://open.kakao.com.evil.test/o/abc", "https://open.kakao.com:8443/o/abc",
    "https://user@open.kakao.com/o/abc", "https://open.kakao.com/o/abc?redirect=x",
    "http://open.kakao.com/o/abc", "javascript:alert(1)",
  ])("restricts open chat URLs: %s", (url) => {
    expect(() => normalizeRoommatePostInput({ ...input, openChatUrl: url }, { now })).toThrow();
  });

  it("keeps unspecified habits separate and rejects exclusive sleep combinations", () => {
    expect(normalizeRoommateHabits({ sleepHabits: [], temperature: ["heat", "cold", "heat"] })).toEqual({ temperature: ["heat", "cold"] });
    expect(() => normalizeRoommateHabits({ sleepHabits: ["none", "snoring"] })).toThrow();
    expect(() => normalizeRoommateHabits({ sleepHabits: ["unknown", "talking"] })).toThrow();
    expect(() => normalizeRoommateHabits({ smoking: "anything" })).toThrow();
    expect(() => normalizeRoommateHabits({ studentNumber: "1" })).toThrow();
  });

  it("requires all filter values and handles overlapping stay dates", () => {
    const filters = parseRoommateFilters(new URLSearchParams("dorm=eden&roomSize=3&stayStart=2026-11-01&stayEnd=2026-11-30&temperature=heat,cold&smoking=nonsmoker"));
    expect(matchesRoommateFilters(input, filters)).toBe(false);
    expect(matchesRoommateFilters({ ...input, dorm: "eden", habits: { temperature: ["heat", "cold"], smoking: "nonsmoker" } }, filters)).toBe(true);
    expect(matchesRoommateFilters({ ...input, dorm: "eden", habits: { temperature: ["heat"], smoking: "nonsmoker" } }, filters)).toBe(false);
    expect(() => parseRoommateFilters(new URLSearchParams("ownerKey=victim"))).toThrow();
  });
});
