import {
  normalizeCourseName,
  type LectureDay,
  type LectureTimetableCourse,
} from "@/lib/lecture-timetable";

export const FILTERABLE_LECTURE_DAYS: LectureDay[] = [
  "월",
  "화",
  "수",
  "목",
  "금",
  "토",
  "일",
];

export type LectureSearchMatchField =
  | "identity"
  | "courseName"
  | "professor"
  | "departmentName"
  | "collegeName"
  | "completionType"
  | "areaType"
  | "classTime"
  | "place"
  | "note"
  | "teamTeaching";

export interface LectureTimetableFilters {
  query: string;
  department: string;
  grade: string;
  completionType: string;
  days: LectureDay[];
  startPeriod: number | null;
  endPeriod: number | null;
}

export function filterLectureTimetableCourses(
  courses: LectureTimetableCourse[],
  filters: LectureTimetableFilters,
): LectureTimetableCourse[] {
  return courses.filter((course) => {
    if (
      filters.department &&
      course.departmentName !== filters.department
    ) {
      return false;
    }

    if (filters.grade && course.grade?.toString() !== filters.grade) {
      return false;
    }

    if (
      filters.completionType &&
      course.completionType !== filters.completionType
    ) {
      return false;
    }

    if (
      filters.query &&
      getLectureCourseSearchMatches(course, filters.query).length === 0
    ) {
      return false;
    }

    if (!hasActiveTimeFilter(filters)) return true;

    const selectedDays = new Set(filters.days);
    const [rangeStart, rangeEnd] = normalizePeriodRange(
      filters.startPeriod,
      filters.endPeriod,
    );

    return course.timeSlots.some((slot) => {
      if (selectedDays.size > 0 && !selectedDays.has(slot.day)) return false;
      if (rangeStart != null && slot.endPeriod < rangeStart) return false;
      if (rangeEnd != null && slot.startPeriod > rangeEnd) return false;
      return true;
    });
  });
}

export function getLectureCourseSearchMatches(
  course: LectureTimetableCourse,
  query: string,
): LectureSearchMatchField[] {
  const normalizedQuery = normalizeLectureSearchText(query);
  if (!normalizedQuery) return [];

  const fields: Array<[LectureSearchMatchField, string | undefined]> = [
    ["identity", [course.id, course.courseCode].filter(Boolean).join(" ")],
    ["courseName", [course.courseName, course.normalizedName].join(" ")],
    ["professor", course.professor],
    ["departmentName", course.departmentName],
    ["collegeName", course.collegeName],
    ["completionType", course.completionType],
    ["areaType", course.areaType],
    ["classTime", course.classTime],
    ["place", course.place],
    ["note", course.note],
    ["teamTeaching", course.teamTeaching],
  ];

  return fields
    .filter(([, value]) =>
      normalizeLectureSearchText(value ?? "").includes(normalizedQuery),
    )
    .map(([field]) => field);
}

function hasActiveTimeFilter(
  filters: Pick<
    LectureTimetableFilters,
    "days" | "startPeriod" | "endPeriod"
  >,
): boolean {
  return (
    filters.days.length > 0 ||
    filters.startPeriod != null ||
    filters.endPeriod != null
  );
}

export function normalizeLectureSearchText(value: string): string {
  return normalizeCourseName(value).replace(/[^0-9a-z가-힣]/g, "");
}

function normalizePeriodRange(
  startPeriod: number | null,
  endPeriod: number | null,
): [number | null, number | null] {
  if (startPeriod == null || endPeriod == null) {
    return [startPeriod, endPeriod];
  }

  return startPeriod <= endPeriod
    ? [startPeriod, endPeriod]
    : [endPeriod, startPeriod];
}
