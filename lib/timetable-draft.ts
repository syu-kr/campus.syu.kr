export const TIMETABLE_DRAFT_STORAGE_KEY =
  "syu-campus-timetable-draft-v1";
export const TIMETABLE_DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const TIMETABLE_DRAFT_VERSION = 1;
const MAX_DRAFT_COURSES = 500;

export interface TimetableDraft {
  version: typeof TIMETABLE_DRAFT_VERSION;
  courseIds: string[];
  year: string | null;
  semester: string | null;
  updatedAt: string;
}

export function createTimetableDraft(
  courseIds: string[],
  year?: string,
  semester?: string,
  now = Date.now(),
): TimetableDraft {
  return {
    version: TIMETABLE_DRAFT_VERSION,
    courseIds: normalizeCourseIds(courseIds),
    year: normalizeNullableString(year),
    semester: normalizeNullableString(semester),
    updatedAt: new Date(now).toISOString(),
  };
}

export function parseTimetableDraft(
  raw: string,
  now = Date.now(),
): TimetableDraft | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== TIMETABLE_DRAFT_VERSION) {
      return null;
    }

    if (
      !Array.isArray(value.courseIds) ||
      value.courseIds.length === 0 ||
      value.courseIds.length > MAX_DRAFT_COURSES ||
      !value.courseIds.every(
        (courseId) => typeof courseId === "string" && courseId.trim(),
      ) ||
      !isNullableString(value.year) ||
      !isNullableString(value.semester) ||
      typeof value.updatedAt !== "string"
    ) {
      return null;
    }

    const updatedAtTimestamp = Date.parse(value.updatedAt);
    if (
      !Number.isFinite(updatedAtTimestamp) ||
      now - updatedAtTimestamp > TIMETABLE_DRAFT_TTL_MS
    ) {
      return null;
    }

    return {
      version: TIMETABLE_DRAFT_VERSION,
      courseIds: normalizeCourseIds(value.courseIds),
      year: normalizeNullableString(value.year),
      semester: normalizeNullableString(value.semester),
      updatedAt: new Date(updatedAtTimestamp).toISOString(),
    };
  } catch {
    return null;
  }
}

export function isTimetableDraftForSemester(
  draft: TimetableDraft,
  year?: string,
  semester?: string,
): boolean {
  return (
    draft.year === normalizeNullableString(year) &&
    draft.semester === normalizeNullableString(semester)
  );
}

export function filterAvailableDraftCourseIds(
  draft: TimetableDraft,
  availableCourseIds: ReadonlySet<string>,
): string[] {
  return draft.courseIds.filter((courseId) => availableCourseIds.has(courseId));
}

function normalizeCourseIds(courseIds: string[]): string[] {
  return Array.from(
    new Set(courseIds.map((courseId) => courseId.trim()).filter(Boolean)),
  );
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
