import { describe, expect, it } from "vitest";
import buses from "@/public/data/shuttle-bus-schedule.json";
import periods from "@/public/data/shuttle-special-periods.json";
import type { PublicHolidaySnapshot, ShuttleSpecialPeriods } from "@/types";
import { createShuttleAnswerSummary } from "./campus-aeo";
import { getCurrentShuttleSummary } from "./shuttle-schedule";
import { PUBLIC_HOLIDAY_SOURCE_URL } from "./public-holidays";
import { getDictionary } from "./i18n";

const now = new Date("2027-01-02T11:55:00+09:00");
const evidence = { sourceUrl: "https://www.syu.ac.kr/school-life/school-bus/",
  verifiedAt: "2026-12-31T12:00:00+09:00" };

describe("verified shuttle answers", () => {
  it.each(["ko", "en"] as const)("uses the confirmed exception source in %s", (locale) => {
    const summary = getCurrentShuttleSummary({ buses, now,
      specialPeriods: { ...periods, serviceExceptions: [{ ...evidence,
        date: "2027-01-02", routeId: "shuttle-1", times: ["12:15"] }] } as ShuttleSpecialPeriods });
    expect(summary.operationEvidence).toEqual([evidence]);
    const answer = createShuttleAnswerSummary({ locale, now, summary });
    expect(answer.answer).toContain("12:15");
    expect(answer.answer).not.toMatch(/2026학년도|공식 시간표 확정 전|Fall 2026|for reference until/);
    expect(answer.source).toContain(evidence.sourceUrl);
    expect(answer.source).not.toMatch(/4월 29|April 29/);
    expect(answer.updatedAt).toMatch(/2026/);
    expect(answer.updatedAt).not.toMatch(/2027/);
  });

  it.each(["ko", "en"] as const)("uses the verified closure source in %s", (locale) => {
    const summary = getCurrentShuttleSummary({ buses, now,
      specialPeriods: { ...periods, closedDates: [{ ...evidence, date: "2027-01-02" }] } as ShuttleSpecialPeriods });
    expect(summary.operationEvidence).toEqual([evidence]);
    const answer = createShuttleAnswerSummary({ locale, now, summary });
    expect(answer.answer).toMatch(/운행되지 않습니다|not operating today/);
    expect(answer.source).toContain(evidence.sourceUrl);
    expect(answer.source).not.toMatch(/4월 29|April 29/);
    expect(answer.items).toBeUndefined();
  });

  it("keeps the ordinary timetable source and reference notice", () => {
    const ordinaryNow = new Date("2026-10-07T11:55:00+09:00");
    const holidays: PublicHolidaySnapshot = { schemaVersion: 1,
      sourceUrl: PUBLIC_HOLIDAY_SOURCE_URL, years: [2026], holidays: [],
      lastSuccessAt: ordinaryNow.toISOString() };
    const summary = getCurrentShuttleSummary({ buses, now: ordinaryNow,
      holidays, specialPeriods: periods as ShuttleSpecialPeriods });
    expect(summary.operationEvidence).toEqual([]);
    const answer = createShuttleAnswerSummary({ locale: "ko", now: ordinaryNow, summary });
    expect(answer.source).toContain("2026년 4월 29일");
    expect(answer.answer).toContain("공식 시간표 확정 전 참고용");
  });
});

describe("public holiday shuttle answers", () => {
  it.each(["ko", "en"] as const)("distinguishes confirmed holidays from missing information in %s", (locale) => {
    const now = new Date("2026-10-09T11:55:00+09:00");
    const holidays: PublicHolidaySnapshot = {
      schemaVersion: 1, sourceUrl: PUBLIC_HOLIDAY_SOURCE_URL, years: [2026],
      lastSuccessAt: now.toISOString(), holidays: [{ date: "2026-10-09", names: ["한글날"] }],
    };
    const text = getDictionary(locale).publicHolidays;
    const answerWith = (snapshot?: PublicHolidaySnapshot) => createShuttleAnswerSummary({
      locale, now, summary: getCurrentShuttleSummary({ buses, now,
        specialPeriods: periods as ShuttleSpecialPeriods, holidays: snapshot }),
    });

    const holidayAnswer = answerWith(holidays);
    expect(holidayAnswer.answer).toBe(text.shuttleHolidayClosedNamed.replace("{holiday}", "한글날"));
    expect(holidayAnswer.answer).not.toContain(text.shuttleUnconfirmed);
    expect(holidayAnswer.answer).not.toContain(text.referenceSchedule);
    expect(holidayAnswer.items).toBeUndefined();

    const unknownAnswer = answerWith();
    expect(unknownAnswer.answer).toContain(text.shuttleUnconfirmed);
    expect(unknownAnswer.answer).not.toContain(text.shuttleHolidayClosed);
    expect(unknownAnswer.items).toBeUndefined();
  });
});
