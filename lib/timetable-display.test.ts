import { describe, expect, it } from "vitest";

import type { LectureTimetableCourse } from "@/lib/lecture-timetable";
import {
  getCoursesBeyondVisibleTimetable,
  LAST_VISIBLE_TIMETABLE_PERIOD,
  TIMETABLE_DAYS,
  TIMETABLE_PERIODS,
} from "@/lib/timetable-display";

function course(
  id: string,
  startPeriod: number,
  endPeriod: number,
): LectureTimetableCourse {
  return {
    id,
    courseName: id,
    normalizedName: id,
    credits: 3,
    timeSlots: [{ day: "월", startPeriod, endPeriod }],
  };
}

describe("timetable display policy", () => {
  it("shows every official lecture day and periods 1 through 12", () => {
    expect(TIMETABLE_DAYS).toEqual(["월", "화", "수", "목", "금", "토", "일"]);
    expect(TIMETABLE_PERIODS).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(LAST_VISIBLE_TIMETABLE_PERIOD).toBe(12);
  });

  it("keeps courses extending past period 12 in a separate summary", () => {
    const visible = course("visible", 10, 12);
    const crossing = course("crossing", 12, 14);
    const later = course("later", 15, 16);

    expect(
      getCoursesBeyondVisibleTimetable([visible, crossing, later]).map(
        (item) => item.id,
      ),
    ).toEqual(["crossing", "later"]);
  });
});
