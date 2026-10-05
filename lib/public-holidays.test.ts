import { describe, expect, it } from "vitest";
import type { PublicHolidaySnapshot } from "../types/public-holidays";
import { getTodayInfo } from "./home";
import { emptyPublicHolidays, getPublicHoliday, mergePublicHolidays, parsePublicHolidaySnapshot, PUBLIC_HOLIDAY_SOURCE_URL } from "./public-holidays";

const now = new Date("2026-10-05T00:00:00Z");
const snapshot: PublicHolidaySnapshot = {
  schemaVersion: 1, sourceUrl: PUBLIC_HOLIDAY_SOURCE_URL,
  lastSuccessAt: "2026-10-04T00:00:00Z", years: [2026],
  holidays: [{ date: "2026-10-05", names: ["대체공휴일(개천절)"] }],
};

describe("shared public holiday lookup", () => {
  it("distinguishes known holidays, non-holidays, and missing coverage", () => {
    expect(getPublicHoliday("2026.10.05", snapshot, now).status).toBe("holiday");
    expect(getPublicHoliday("2026-10-06", snapshot, now).status).toBe("not-holiday");
    expect(getPublicHoliday("2027-10-05", snapshot, now).status).toBe("unknown");
    expect(getPublicHoliday("2026-10-05", emptyPublicHolidays(), now).status).toBe("unknown");
    expect(getPublicHoliday("2026-02-30", snapshot, now).status).toBe("unknown");
  });

  it("preserves known names but does not confirm absent dates after a failed or delayed update", () => {
    const delayed = new Date("2026-10-09T00:00:00Z");
    expect(getPublicHoliday("2026-10-05", snapshot, delayed)).toMatchObject({ status: "holiday", isStale: true });
    expect(getPublicHoliday("2026-10-06", snapshot, delayed).status).toBe("unknown");
    expect(getPublicHoliday("2026-10-06", { ...snapshot, stale: true }, now).status).toBe("unknown");
    expect(getPublicHoliday("2026-10-06", { ...snapshot, lastSuccessAt: "2026-10-06T00:00:00Z" }, now).status).toBe("unknown");
  });

  it("uses the same date at the Korean midnight boundary", () => {
    const before = new Date("2026-10-04T14:59:59Z");
    const after = new Date("2026-10-04T15:00:00Z");
    expect(getPublicHoliday(getTodayInfo(before).dateStringDash, snapshot, before).status).toBe("not-holiday");
    expect(getPublicHoliday(getTodayInfo(after).dateStringDash, snapshot, after).status).toBe("holiday");
  });

  it("merges only duplicate one-day holiday names and preserves exams and school holiday ranges", () => {
    const schedules = [
      { id: "duplicate", title: "대체휴일", startDate: "2026.10.05", endDate: "2026.10.05", category: "event" as const },
      { id: "exam", title: "중간고사", startDate: "2026.10.05", endDate: "2026.10.05", category: "exam" as const },
      { id: "range", title: "학교 연휴", startDate: "2026.10.03", endDate: "2026.10.06", category: "holiday" as const },
    ];
    const merged = mergePublicHolidays(schedules, snapshot);
    expect(merged.map((item) => item.id)).toEqual(["range", "exam", "public-holiday-2026-10-05"]);
    expect(schedules).toHaveLength(3);
    expect(merged.find((item) => item.id.startsWith("public-holiday-"))?.title).toBe("대체공휴일(개천절)");
  });

  it.each([
    ["2026-05-01", "근로자의 날", "노동절"],
    ["2026-06-03", "지방선거", "전국동시지방선거"],
    ["2027-01-01", "신정", "1월1일"],
  ])("merges the same-day school alias %s %s into the official holiday %s", (date, schoolName, officialName) => {
    const scheduleDate = date.replaceAll("-", ".");
    const schedules = [
      { id: "duplicate", title: schoolName, startDate: scheduleDate, endDate: scheduleDate, category: "event" as const },
      { id: "school-class", title: "보강", startDate: scheduleDate, endDate: scheduleDate, category: "event" as const },
    ];
    const merged = mergePublicHolidays(schedules, {
      ...snapshot, years: [Number(date.slice(0, 4))], holidays: [{ date, names: [officialName] }],
    });
    expect(merged).toHaveLength(2);
    expect(merged.find((item) => item.id === "duplicate")).toBeUndefined();
    expect(merged.find((item) => item.id === "school-class")?.title).toBe("보강");
    expect(merged.find((item) => item.id === `public-holiday-${date}`)?.title).toBe(officialName);
    expect(schedules[0].title).toBe(schoolName);
  });

  it("validates coverage, dates, duplicate names and credential-free provenance", () => {
    expect(parsePublicHolidaySnapshot(snapshot)).toEqual(snapshot);
    expect(parsePublicHolidaySnapshot(emptyPublicHolidays()).years).toEqual([]);
    const invalid = [
      { ...snapshot, sourceUrl: `${PUBLIC_HOLIDAY_SOURCE_URL}?serviceKey=secret` },
      { ...snapshot, years: [2026, 2026] },
      { ...snapshot, lastSuccessAt: null },
      { ...snapshot, lastSuccessAt: "2026-02-30T00:00:00Z" },
      { ...snapshot, holidays: [{ date: "2027-10-05", names: ["공휴일"] }] },
      { ...snapshot, holidays: [{ date: "2026-02-30", names: ["공휴일"] }] },
      { ...snapshot, holidays: [...snapshot.holidays, ...snapshot.holidays] },
      { ...snapshot, holidays: [{ date: "2026-10-05", names: ["공휴일", "공휴일"] }] },
    ];
    invalid.forEach((value) => expect(() => parsePublicHolidaySnapshot(value)).toThrow());
  });
});
