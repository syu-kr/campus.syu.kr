import {
  createTimetableWorkspace,
  getActiveTimetable,
  hasWorkspaceCourses,
  MAX_TIMETABLES,
  normalizeTimetableWorkspace,
  type TimetableWorkspace,
  type TimetableWorkspaceItem,
} from "@/lib/timetable-workspace";

export const TIMETABLE_DRAFT_STORAGE_KEY =
  "syu-campus-timetable-draft-v1";
export const TIMETABLE_DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const TIMETABLE_DRAFT_VERSION = 2;
const LEGACY_TIMETABLE_DRAFT_VERSION = 1;
const MAX_DRAFT_COURSES = 500;

export interface TimetableDraft {
  version: typeof TIMETABLE_DRAFT_VERSION;
  workspace: TimetableWorkspace;
  year: string | null;
  semester: string | null;
  updatedAt: string;
}

interface LegacyTimetableDraft {
  version: typeof LEGACY_TIMETABLE_DRAFT_VERSION;
  courseIds: string[];
  year: string | null;
  semester: string | null;
  updatedAt: string;
}

export function createTimetableDraft(
  workspaceOrCourseIds: TimetableWorkspace | string[],
  year?: string,
  semester?: string,
  now = Date.now(),
): TimetableDraft {
  const workspace = Array.isArray(workspaceOrCourseIds)
    ? createTimetableWorkspace(workspaceOrCourseIds)
    : normalizeTimetableWorkspace(workspaceOrCourseIds);

  return {
    version: TIMETABLE_DRAFT_VERSION,
    workspace,
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
    if (!isRecord(value)) return null;

    const commonFields = parseCommonDraftFields(value, now);
    if (!commonFields) return null;

    if (value.version === LEGACY_TIMETABLE_DRAFT_VERSION) {
      const legacyDraft = parseLegacyTimetableDraft(value, commonFields);
      if (!legacyDraft) return null;
      return createTimetableDraft(
        legacyDraft.courseIds,
        legacyDraft.year ?? undefined,
        legacyDraft.semester ?? undefined,
        Date.parse(legacyDraft.updatedAt),
      );
    }

    if (value.version !== TIMETABLE_DRAFT_VERSION) return null;
    const workspace = parseWorkspace(value.workspace);
    if (!workspace || !hasWorkspaceCourses(workspace)) return null;

    return {
      version: TIMETABLE_DRAFT_VERSION,
      workspace,
      ...commonFields,
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

export function filterAvailableDraftWorkspace(
  draft: TimetableDraft,
  availableCourseIds: ReadonlySet<string>,
): TimetableWorkspace {
  const workspace = normalizeTimetableWorkspace({
    ...draft.workspace,
    timetables: draft.workspace.timetables.map((timetable) => ({
      ...timetable,
      courseIds: timetable.courseIds.filter((courseId) =>
        availableCourseIds.has(courseId),
      ),
    })),
  });

  return workspace;
}

export function filterAvailableDraftCourseIds(
  draft: TimetableDraft,
  availableCourseIds: ReadonlySet<string>,
): string[] {
  return getActiveTimetable(
    filterAvailableDraftWorkspace(draft, availableCourseIds),
  ).courseIds;
}

function parseWorkspace(value: unknown): TimetableWorkspace | null {
  if (!isRecord(value) || !Array.isArray(value.timetables)) return null;
  if (
    typeof value.activeTimetableId !== "string" ||
    typeof value.isCompareMode !== "boolean" ||
    value.timetables.length === 0 ||
    value.timetables.length > MAX_TIMETABLES
  ) {
    return null;
  }

  const timetables: TimetableWorkspaceItem[] = [];
  let courseCount = 0;
  for (const timetable of value.timetables) {
    if (
      !isRecord(timetable) ||
      typeof timetable.id !== "string" ||
      !timetable.id.trim() ||
      !Array.isArray(timetable.courseIds) ||
      !timetable.courseIds.every(
        (courseId) => typeof courseId === "string" && courseId.trim(),
      )
    ) {
      return null;
    }

    courseCount += timetable.courseIds.length;
    if (courseCount > MAX_DRAFT_COURSES) return null;
    timetables.push({
      id: timetable.id,
      courseIds: timetable.courseIds,
    });
  }

  return normalizeTimetableWorkspace({
    activeTimetableId: value.activeTimetableId,
    isCompareMode: value.isCompareMode,
    timetables,
  });
}

function parseLegacyTimetableDraft(
  value: Record<string, unknown>,
  commonFields: Pick<TimetableDraft, "year" | "semester" | "updatedAt">,
): LegacyTimetableDraft | null {
  if (
    !Array.isArray(value.courseIds) ||
    value.courseIds.length === 0 ||
    value.courseIds.length > MAX_DRAFT_COURSES ||
    !value.courseIds.every(
      (courseId) => typeof courseId === "string" && courseId.trim(),
    )
  ) {
    return null;
  }

  return {
    version: LEGACY_TIMETABLE_DRAFT_VERSION,
    courseIds: normalizeCourseIds(value.courseIds),
    ...commonFields,
  };
}

function parseCommonDraftFields(
  value: Record<string, unknown>,
  now: number,
): Pick<TimetableDraft, "year" | "semester" | "updatedAt"> | null {
  if (
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
    year: normalizeNullableString(value.year),
    semester: normalizeNullableString(value.semester),
    updatedAt: new Date(updatedAtTimestamp).toISOString(),
  };
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
