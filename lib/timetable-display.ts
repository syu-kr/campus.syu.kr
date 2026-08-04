import type {
  LectureDay,
  LectureTimetableCourse,
} from "@/lib/lecture-timetable";

const ALL_TIMETABLE_DAYS: LectureDay[] = [
  "월",
  "화",
  "수",
  "목",
  "금",
  "토",
  "일",
];

export const DEFAULT_TIMETABLE_PERIOD_COUNT = 9;

export const TIMETABLE_FILTER_PERIODS = Array.from(
  { length: 12 },
  (_, index) => index + 1,
);

export function getVisibleTimetableDays(
  courses: LectureTimetableCourse[],
): LectureDay[] {
  const lastDayIndex = courses.reduce((currentLastDayIndex, course) => {
    return course.timeSlots.reduce((courseLastDayIndex, slot) => {
      const dayIndex = ALL_TIMETABLE_DAYS.indexOf(slot.day);
      return Math.max(courseLastDayIndex, dayIndex);
    }, currentLastDayIndex);
  }, 4);

  return ALL_TIMETABLE_DAYS.slice(0, lastDayIndex + 1);
}

export function getVisibleTimetablePeriods(
  courses: LectureTimetableCourse[],
): number[] {
  const lastPeriod = courses.reduce((currentLastPeriod, course) => {
    return course.timeSlots.reduce(
      (courseLastPeriod, slot) =>
        Math.max(courseLastPeriod, slot.endPeriod),
      currentLastPeriod,
    );
  }, DEFAULT_TIMETABLE_PERIOD_COUNT);

  return Array.from({ length: lastPeriod }, (_, index) => index + 1);
}
