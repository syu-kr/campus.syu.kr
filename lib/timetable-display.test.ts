import { describe, expect, it } from "vitest";

import type { LectureTimetableCourse } from "@/lib/lecture-timetable";
import {
  DEFAULT_TIMETABLE_PERIOD_COUNT,
  getVisibleTimetableDays,
  getVisibleTimetablePeriods,
  TIMETABLE_FILTER_PERIODS,
} from "@/lib/timetable-display";

function course(
  id: string,
  startPeriod: number,
  endPeriod: number,
  day: LectureTimetableCourse["timeSlots"][number]["day"] = "월",
): LectureTimetableCourse {
  return {
    id,
    courseName: id,
    normalizedName: id,
    credits: 3,
    timeSlots: [{ day, startPeriod, endPeriod }],
  };
}

describe("timetable display policy", () => {
  it("starts with weekdays and periods 1 through 9", () => {
    expect(getVisibleTimetableDays([])).toEqual(["월", "화", "수", "목", "금"]);
    expect(getVisibleTimetablePeriods([])).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(DEFAULT_TIMETABLE_PERIOD_COUNT).toBe(9);
  });

  it("adds weekend days in order when selected courses require them", () => {
    expect(getVisibleTimetableDays([course("sat", 1, 2, "토")])).toEqual([
      "월", "화", "수", "목", "금", "토",
    ]);
    expect(getVisibleTimetableDays([course("sun", 1, 2, "일")])).toEqual([
      "월", "화", "수", "목", "금", "토", "일",
    ]);
  });

  it("adds every period through the latest selected course", () => {
    expect(
      getVisibleTimetablePeriods([course("late", 15, 15)]),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it("keeps course filter options capped at period 12", () => {
    expect(TIMETABLE_FILTER_PERIODS).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });
});
