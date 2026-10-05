import { describe, expect, it } from "vitest";
import { createAcademicScheduleAnswerSummary } from "./academic-aeo";
import { getTodayInfo } from "./home";
import { getDictionary } from "./i18n";
import { emptyPublicHolidays, PUBLIC_HOLIDAY_SOURCE_URL } from "./public-holidays";
import type { PublicHolidaySnapshot } from "@/types/public-holidays";

const now = new Date("2026-10-08T15:00:00Z");
const publicHolidays: PublicHolidaySnapshot = {
  schemaVersion: 1,
  sourceUrl: PUBLIC_HOLIDAY_SOURCE_URL,
  lastSuccessAt: "2026-10-08T12:00:00Z",
  years: [2026],
  holidays: [{ date: "2026-10-09", names: ["한글날"] }],
};

describe("academic search answers with public holidays", () => {
  it.each(["ko", "en"] as const)("uses the Korean date, merges duplicate holidays and retains school events in %s", (locale) => {
    const answer = createAcademicScheduleAnswerSummary({
      locale, now, todayInfo: getTodayInfo(now), publicHolidays,
      schedules: [
        { id: "school-holiday", title: "한글날", startDate: "2026.10.09", endDate: "2026.10.09", category: "event" },
        { id: "exam", title: "중간고사", startDate: "2026.10.09", endDate: "2026.10.10", category: "exam" },
      ],
    });
    expect(answer.answer).toContain("한글날");
    expect(answer.answer.match(/한글날/g)).toHaveLength(1);
    expect(answer.answer).toContain("중간고사");
    expect(answer.items?.[1].value).toBe("2");
    expect(answer.source).toContain(getDictionary(locale).publicHolidays.source);
  });

  it("states missing coverage and stale collection without treating either as an absence of holidays", () => {
    const text = getDictionary("ko").publicHolidays;
    const summarize = (snapshot: PublicHolidaySnapshot) => createAcademicScheduleAnswerSummary({
      locale: "ko", now, todayInfo: getTodayInfo(now), schedules: [], publicHolidays: snapshot,
    });
    expect(summarize(emptyPublicHolidays()).answer).toContain(text.unavailable);
    const staleAnswer = summarize({ ...publicHolidays, stale: true });
    expect(staleAnswer.answer).toContain("한글날");
    expect(staleAnswer.answer).toContain(text.stale);
  });
});
