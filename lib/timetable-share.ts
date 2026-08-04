import {
  hasWorkspaceCourses,
  MAX_TIMETABLES,
  normalizeTimetableWorkspace,
  type TimetableWorkspace,
  type TimetableWorkspaceItem,
} from "@/lib/timetable-workspace";

export const MAX_SHARED_COURSES = 120;
const MAX_SHARED_ASSIGNMENTS = MAX_SHARED_COURSES * MAX_TIMETABLES;
const MAX_COURSE_ID_LENGTH = 120;

export interface StoredTimetableWorkspace {
  active_timetable_id: string;
  is_compare_mode: boolean;
  timetables: Array<{
    id: string;
    course_ids: string[];
  }>;
}

export function parseSharedTimetableWorkspace(
  value: unknown,
): TimetableWorkspace | null {
  if (!isRecord(value)) return null;

  const activeTimetableId = stringValue(
    value.activeTimetableId ?? value.active_timetable_id,
  );
  const isCompareMode =
    value.isCompareMode ?? value.is_compare_mode;
  const rawTimetables = value.timetables;

  if (
    !activeTimetableId ||
    typeof isCompareMode !== "boolean" ||
    !Array.isArray(rawTimetables) ||
    rawTimetables.length === 0 ||
    rawTimetables.length > MAX_TIMETABLES
  ) {
    return null;
  }

  const timetables: TimetableWorkspaceItem[] = [];
  const distinctCourseIds = new Set<string>();
  let assignmentCount = 0;

  for (const rawTimetable of rawTimetables) {
    if (!isRecord(rawTimetable)) return null;
    const id = stringValue(rawTimetable.id);
    const rawCourseIds = rawTimetable.courseIds ?? rawTimetable.course_ids;
    if (!id || !Array.isArray(rawCourseIds)) return null;

    const courseIds = rawCourseIds
      .map((courseId) => (typeof courseId === "string" ? courseId.trim() : ""))
      .filter(Boolean);
    if (
      courseIds.length !== rawCourseIds.length ||
      courseIds.some((courseId) => courseId.length > MAX_COURSE_ID_LENGTH)
    ) {
      return null;
    }

    assignmentCount += courseIds.length;
    courseIds.forEach((courseId) => distinctCourseIds.add(courseId));
    if (
      assignmentCount > MAX_SHARED_ASSIGNMENTS ||
      distinctCourseIds.size > MAX_SHARED_COURSES
    ) {
      return null;
    }

    timetables.push({ id, courseIds });
  }

  const workspace = normalizeTimetableWorkspace({
    activeTimetableId,
    isCompareMode,
    timetables,
  });

  return hasWorkspaceCourses(workspace) ? workspace : null;
}

export function toStoredTimetableWorkspace(
  workspace: TimetableWorkspace,
): StoredTimetableWorkspace {
  const normalized = normalizeTimetableWorkspace(workspace);
  return {
    active_timetable_id: normalized.activeTimetableId,
    is_compare_mode: normalized.isCompareMode,
    timetables: normalized.timetables.map((timetable) => ({
      id: timetable.id,
      course_ids: timetable.courseIds,
    })),
  };
}

export function getRepresentativeCourseIds(
  workspace: TimetableWorkspace,
): string[] {
  const normalized = normalizeTimetableWorkspace(workspace);
  const activeTimetable = normalized.timetables.find(
    (timetable) => timetable.id === normalized.activeTimetableId,
  );
  if (activeTimetable && activeTimetable.courseIds.length > 0) {
    return activeTimetable.courseIds;
  }

  return (
    normalized.timetables.find((timetable) => timetable.courseIds.length > 0)
      ?.courseIds ?? []
  );
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
