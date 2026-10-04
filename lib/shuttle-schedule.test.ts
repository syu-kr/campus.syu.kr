import { describe, expect, it } from "vitest";

import { createShuttleAnswerSummary } from "./campus-aeo";
import {
  getCurrentShuttleSummary,
  timeToMinutes,
} from "./shuttle-schedule";
import buses from "@/public/data/shuttle-bus-schedule.json";
import periods from "@/public/data/shuttle-special-periods.json";
import type { ShuttleSpecialPeriods } from "@/types";
import type { PublicHolidaySnapshot } from "@/types/public-holidays";
import { PUBLIC_HOLIDAY_SOURCE_URL } from "./public-holidays";

const specialPeriods = periods as ShuttleSpecialPeriods;

function summarize(dateTime: string) {
  return getCurrentShuttleSummary({
    buses,
    specialPeriods,
    now: new Date(dateTime),
    holidays: {
      schemaVersion: 1, sourceUrl: PUBLIC_HOLIDAY_SOURCE_URL,
      years: [2026], holidays: [], lastSuccessAt: dateTime,
    },
  });
}

describe("timeToMinutes", () => {
  it("parses valid times and rejects invalid ranges", () => {
    expect(timeToMinutes("08:05")).toBe(485);
    expect(timeToMinutes("24:00")).toBeNull();
    expect(timeToMinutes("08:60")).toBeNull();
    expect(timeToMinutes("invalid")).toBeNull();
  });
});

describe("public holiday shuttle operation", () => {
  const now = new Date("2026-10-09T11:55:00+09:00");
  const holidays: PublicHolidaySnapshot = {
    schemaVersion: 1, sourceUrl: PUBLIC_HOLIDAY_SOURCE_URL, years: [2026],
    holidays: [{ date: "2026-10-09", names: ["한글날"] }],
    lastSuccessAt: "2026-10-09T00:00:00+09:00",
  };
  const summarizeWith = (options: {
    holidays?: PublicHolidaySnapshot; specialPeriods?: ShuttleSpecialPeriods; now?: Date;
  } = {}) => getCurrentShuttleSummary({ buses, specialPeriods, holidays, now, ...options });

  it("preserves predictions on a covered ordinary day", () => {
    const summary = summarizeWith({ now: new Date("2026-10-09T11:55:00+09:00"),
      holidays: { ...holidays, holidays: [] } });
    expect(summary.operationStatus).toBe("regular");
    expect(summary.departures.length).toBeGreaterThan(0);
  });

  it.each([
    ["public holiday", holidays],
    ["unknown year", { ...holidays, years: [2025], holidays: [] }],
    ["stale non-holiday", { ...holidays, holidays: [], lastSuccessAt: "2026-09-01T00:00:00Z" }],
    ["missing snapshot", undefined],
  ])("suppresses departures and add/replace services for %s", (_, snapshot) => {
    const summary = summarizeWith({ holidays: snapshot as PublicHolidaySnapshot | undefined,
      specialPeriods: { ...specialPeriods, specialPeriods: [{
        ...specialPeriods.specialPeriods[0], applicableDates: ["2026-10-09"],
        routes: ["all"], addedTimes: ["12:00"],
      }] },
    });
    expect(summary.operationStatus).toBe("unconfirmed");
    expect(summary.departures).toEqual([]);
    expect(summary.additionalServicePeriods).toEqual([]);
    expect(summary.hasMoreToday).toBe(false);
  });

  it("honors only verified route-specific service, including weekends outside operating periods", () => {
    const summary = summarizeWith({ now: new Date("2027-01-02T11:55:00+09:00"),
      specialPeriods: { ...specialPeriods, serviceExceptions: [{
        date: "2027-01-02", routeId: "shuttle-1", times: ["12:15"],
        sourceUrl: "https://www.syu.ac.kr/school-life/school-bus/", verifiedAt: "2026-10-09",
      }] },
    });
    expect(summary.operationStatus).toBe("exception");
    expect(summary.isWeekend).toBe(false);
    expect(summary.isOperatingPeriod).toBe(true);
    expect(summary.departures).toEqual([{ routeName: buses[1].routeName,
      time: "12:15", minutesUntil: 20 }]);
  });

  it("requires a valid source, verification time and departure times for exceptions", () => {
    const exception = { date: "2026-10-09", routeId: "shuttle-1", times: ["12:15"],
      sourceUrl: "https://www.syu.ac.kr/school-life/school-bus/", verifiedAt: "2026-10-08" };
    for (const record of [
      { ...exception, sourceUrl: "" }, { ...exception, verifiedAt: "2026-10-10" },
      { ...exception, times: ["24:00"] },
    ]) {
      expect(summarizeWith({ specialPeriods: { ...specialPeriods, serviceExceptions: [record] } })
        .operationStatus).toBe("unconfirmed");
    }
  });

  it("applies a verified closure and lets a verified exception override that date", () => {
    const overrides: ShuttleSpecialPeriods = { ...specialPeriods, closedDates: [{
      date: "2026-10-09", sourceUrl: "https://www.syu.ac.kr/school-life/school-bus/", verifiedAt: "2026-10-08",
    }] };
    expect(summarizeWith({ specialPeriods: overrides }).operationStatus).toBe("closed");
    const exception = { date: "2026-10-09", routeId: "shuttle-1", times: ["12:15"],
      sourceUrl: "https://www.syu.ac.kr/school-life/school-bus/", verifiedAt: "2026-10-08" };
    expect(summarizeWith({ specialPeriods: { ...overrides, serviceExceptions: [exception] } })
      .operationStatus).toBe("exception");
  });

  it.each(["ko", "en"] as const)("keeps the %s search answer consistent with holiday uncertainty", (locale) => {
    const answer = createShuttleAnswerSummary({ locale, now, summary: summarizeWith() });
    expect(answer.answer).toContain("한글날");
    expect(answer.answer).not.toMatch(/12:00|분 남았습니다|minutes from now/);
    expect(answer.items).toBeUndefined();
  });
});

describe("festival night shuttle", () => {
  it.each(["18:16", "21:59", "22:00", "22:29", "22:30"])(
    "keeps both announced services available at %s after regular departures end",
    (time) => {
      const summary = summarize(`2026-10-06T${time}:00+09:00`);
      expect(summary.departures).toEqual([]);
      expect(summary.hasMoreToday).toBe(true);
      expect(summary.additionalServicePeriods[0].additionalServices).toEqual([
        {
          destination: "hwarangdae", vehicleCount: 5, type: "window",
          startTime: "22:00", endTime: "22:30",
        },
        { destination: "byeollae", vehicleCount: 1, type: "departure", time: "22:30" },
      ]);
    },
  );

  it.each([
    "2026-10-05T21:00:00+09:00",
    "2026-10-06T22:31:00+09:00",
  ])("does not advertise remaining festival service at %s", (dateTime) => {
    const summary = summarize(dateTime);
    expect(summary.additionalServicePeriods).toEqual([]);
    expect(summary.hasMoreToday).toBe(false);
  });

  it("uses the Korean date across UTC midnight and preserves regular departures", () => {
    expect(summarize("2026-10-05T15:00:00Z").additionalServicePeriods).toHaveLength(1);
    expect(summarize("2026-10-06T15:00:00Z").additionalServicePeriods).toEqual([]);
    expect(summarize("2026-10-06T15:00:00Z").departures.length).toBeGreaterThan(0);
    expect(summarize("2026-10-06T11:55:00+09:00").departures).toEqual(
      summarize("2026-10-05T11:55:00+09:00").departures,
    );
  });

  it.each(["ko", "en"] as const)(
    "describes the interval, one-way destinations and announcement source in %s search answers",
    (locale) => {
      const now = new Date("2026-10-06T22:15:00+09:00");
      const answer = createShuttleAnswerSummary({ locale, now, summary: summarize(now.toISOString()) });
      expect(answer.items).toHaveLength(2);
      expect(answer.answer).toContain("22:00");
      expect(answer.answer).toContain("22:30");
      expect(answer.answer).not.toMatch(/석계|Seokgye|남은 셔틀 출발편이 없습니다|no remaining shuttle/i);
      expect(answer.source).not.toMatch(/4월 29|April 29/);
      expect(answer.source).toMatch(/학생회|Student Council/);
      expect(answer.answer).toMatch(/조기에 종료|end earlier/);
    },
  );
});
