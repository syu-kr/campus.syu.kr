import type {
  LectureDay,
  LectureTimetableCourse,
} from "@/lib/lecture-timetable";

export const TIMETABLE_DAYS: LectureDay[] = [
  "월",
  "화",
  "수",
  "목",
  "금",
  "토",
  "일",
];

export const LAST_VISIBLE_TIMETABLE_PERIOD = 12;

export const TIMETABLE_PERIODS = Array.from(
  { length: LAST_VISIBLE_TIMETABLE_PERIOD },
  (_, index) => index + 1,
);

export function getCoursesBeyondVisibleTimetable(
  courses: LectureTimetableCourse[],
): LectureTimetableCourse[] {
  return courses.filter((course) =>
    course.timeSlots.some(
      (slot) => slot.endPeriod > LAST_VISIBLE_TIMETABLE_PERIOD,
    ),
  );
}
