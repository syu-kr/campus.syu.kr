import {
  getBestLectureCredit,
  getLectureMatches,
  type LectureMatchMap,
} from "@/lib/lecture-timetable";
import type {
  CreditCategoryKey,
  CurriculumCourse,
  CurriculumCourseCategory,
  GraduationSelection,
} from "@/lib/graduation";

export const CURRICULUM_CATEGORIES: CurriculumCourseCategory[] = [
  "교필",
  "교선",
  "전필",
  "전선",
];

export function sumCurriculumCredits(
  courses: CurriculumCourse[],
  categories: CurriculumCourseCategory[],
  getCredits: (course: CurriculumCourse) => number = (course) =>
    course.credits ?? 0,
): number {
  return courses
    .filter((course) => categories.includes(course.category))
    .reduce((sum, course) => sum + getCredits(course), 0);
}

export function getCurriculumSummary(
  courses: CurriculumCourse[],
  selectedCourseIds: string[],
  getCredits: (course: CurriculumCourse) => number = (course) =>
    course.credits ?? 0,
): Record<
  CurriculumCourseCategory,
  { totalCount: number; selectedCount: number; selectedCredits: number }
> {
  return CURRICULUM_CATEGORIES.reduce(
    (summary, category) => {
      const categoryCourses = courses.filter(
        (course) => course.category === category,
      );
      const selectedCourses = categoryCourses.filter((course) =>
        selectedCourseIds.includes(course.id),
      );

      summary[category] = {
        totalCount: categoryCourses.length,
        selectedCount: selectedCourses.length,
        selectedCredits: sumCurriculumCredits(
          selectedCourses,
          [category],
          getCredits,
        ),
      };
      return summary;
    },
    {} as Record<
      CurriculumCourseCategory,
      { totalCount: number; selectedCount: number; selectedCredits: number }
    >,
  );
}

export function filterCurriculumCourses(
  courses: CurriculumCourse[],
  category: CurriculumCourseCategory,
  search: string,
  lectureMatchMap: LectureMatchMap,
  departmentName?: string,
): CurriculumCourse[] {
  const query = search.trim().toLowerCase();

  return courses.filter((course) => {
    if (course.category !== category) return false;
    if (!query) return true;

    const matches = getLectureMatches(
      course.name,
      lectureMatchMap,
      departmentName,
    );

    return [
      course.name,
      course.departmentName,
      course.sourcePage,
      course.reviewStatus === "needsReview" ? "확인 필요" : "",
      matches.length > 0 ? "올해 개설 개설" : "개설 정보 없음",
      ...matches.flatMap((match) => [
        match.courseName,
        match.completionType,
        match.professor,
        match.grade ? `${match.grade}학년` : "",
        match.credits == null ? "" : `${match.credits}학점`,
      ]),
      course.credits == null ? "학점 확인 필요" : `${course.credits}학점`,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}

export function getEffectiveCurriculumCredits(
  course: CurriculumCourse,
  lectureMatchMap: LectureMatchMap,
  departmentName?: string,
): number {
  if (course.credits != null) return course.credits;
  return getBestLectureCredit(course.name, lectureMatchMap, departmentName) ?? 0;
}

export function getRequiredCredit(
  summary: Array<{ key: CreditCategoryKey | "totalCredits"; value: number }>,
  key: CreditCategoryKey | "totalCredits",
): number {
  return summary.find((item) => item.key === key)?.value ?? 0;
}

export function getActiveStep(
  selection: GraduationSelection,
  autoTotalCredits: number,
): number {
  if (!selection.collegeId) return 0;
  if (!selection.departmentId) return 1;
  if (!selection.admissionType || !selection.majorTrack) return 2;
  if (autoTotalCredits <= 0) return 3;
  return 4;
}
