import { describe, expect, it } from "vitest";

import { createShuttleAnswerSummary } from "./campus-aeo";
import {
  getCurrentShuttleSummary,
  timeToMinutes,
} from "./shuttle-schedule";
import buses from "@/public/data/shuttle-bus-schedule.json";
import periods from "@/public/data/shuttle-special-periods.json";
import type { ShuttleSpecialPeriods } from "@/types";

const specialPeriods = periods as ShuttleSpecialPeriods;

function summarize(dateTime: string) {
  return getCurrentShuttleSummary({
    buses,
    specialPeriods,
    now: new Date(dateTime),
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
