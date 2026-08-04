export const MAX_TIMETABLES = 4;

export interface TimetableWorkspaceItem {
  id: string;
  courseIds: string[];
}

export interface TimetableWorkspace {
  activeTimetableId: string;
  isCompareMode: boolean;
  timetables: TimetableWorkspaceItem[];
}

export function createTimetableWorkspace(
  courseIds: string[] = [],
): TimetableWorkspace {
  const firstTimetable = {
    id: "timetable-1",
    courseIds: normalizeCourseIds(courseIds),
  };

  return {
    activeTimetableId: firstTimetable.id,
    isCompareMode: false,
    timetables: [firstTimetable],
  };
}

export function enterTimetableCompareMode(
  workspace: TimetableWorkspace,
): TimetableWorkspace {
  const nextWorkspace = normalizeTimetableWorkspace(workspace);
  if (nextWorkspace.timetables.length >= 2) {
    return { ...nextWorkspace, isCompareMode: true };
  }

  const nextTimetable = createNextTimetable(nextWorkspace.timetables, []);
  return {
    ...nextWorkspace,
    isCompareMode: true,
    timetables: [...nextWorkspace.timetables, nextTimetable],
  };
}

export function leaveTimetableCompareMode(
  workspace: TimetableWorkspace,
): TimetableWorkspace {
  return { ...normalizeTimetableWorkspace(workspace), isCompareMode: false };
}

export function addTimetable(
  workspace: TimetableWorkspace,
  courseIds: string[] = [],
): TimetableWorkspace {
  const nextWorkspace = normalizeTimetableWorkspace(workspace);
  if (nextWorkspace.timetables.length >= MAX_TIMETABLES) return nextWorkspace;

  const nextTimetable = createNextTimetable(
    nextWorkspace.timetables,
    courseIds,
  );
  return {
    ...nextWorkspace,
    activeTimetableId: nextTimetable.id,
    isCompareMode: true,
    timetables: [...nextWorkspace.timetables, nextTimetable],
  };
}

export function duplicateTimetable(
  workspace: TimetableWorkspace,
  timetableId: string,
): TimetableWorkspace {
  const source = workspace.timetables.find(
    (timetable) => timetable.id === timetableId,
  );
  return source ? addTimetable(workspace, source.courseIds) : workspace;
}

export function removeTimetable(
  workspace: TimetableWorkspace,
  timetableId: string,
): TimetableWorkspace {
  const nextWorkspace = normalizeTimetableWorkspace(workspace);
  if (nextWorkspace.timetables.length <= 2) return nextWorkspace;

  const timetables = nextWorkspace.timetables.filter(
    (timetable) => timetable.id !== timetableId,
  );
  if (timetables.length === nextWorkspace.timetables.length) {
    return nextWorkspace;
  }

  return {
    ...nextWorkspace,
    activeTimetableId: timetables.some(
      (timetable) => timetable.id === nextWorkspace.activeTimetableId,
    )
      ? nextWorkspace.activeTimetableId
      : timetables[0].id,
    timetables,
  };
}

export function setActiveTimetable(
  workspace: TimetableWorkspace,
  timetableId: string,
): TimetableWorkspace {
  return workspace.timetables.some((timetable) => timetable.id === timetableId)
    ? { ...workspace, activeTimetableId: timetableId }
    : workspace;
}

export function replaceTimetableCourseIds(
  workspace: TimetableWorkspace,
  timetableId: string,
  courseIds: string[],
): TimetableWorkspace {
  const normalizedCourseIds = normalizeCourseIds(courseIds);
  return {
    ...workspace,
    timetables: workspace.timetables.map((timetable) =>
      timetable.id === timetableId
        ? { ...timetable, courseIds: normalizedCourseIds }
        : timetable,
    ),
  };
}

export function toggleTimetableCourse(
  workspace: TimetableWorkspace,
  timetableId: string,
  courseId: string,
): TimetableWorkspace {
  const timetable = workspace.timetables.find(
    (candidate) => candidate.id === timetableId,
  );
  if (!timetable) return workspace;

  const courseIds = timetable.courseIds.includes(courseId)
    ? timetable.courseIds.filter((candidate) => candidate !== courseId)
    : [...timetable.courseIds, courseId];

  return replaceTimetableCourseIds(workspace, timetableId, courseIds);
}

export function getActiveTimetable(
  workspace: TimetableWorkspace,
): TimetableWorkspaceItem {
  return (
    workspace.timetables.find(
      (timetable) => timetable.id === workspace.activeTimetableId,
    ) ?? workspace.timetables[0]
  );
}

export function normalizeTimetableWorkspace(
  workspace: TimetableWorkspace,
): TimetableWorkspace {
  const seenIds = new Set<string>();
  const timetables = workspace.timetables
    .slice(0, MAX_TIMETABLES)
    .map((timetable, index) => {
      const candidateId = timetable.id.trim();
      const id =
        candidateId && !seenIds.has(candidateId)
          ? candidateId
          : `timetable-${index + 1}`;
      seenIds.add(id);
      return { id, courseIds: normalizeCourseIds(timetable.courseIds) };
    });

  if (timetables.length === 0) return createTimetableWorkspace();

  return {
    activeTimetableId: timetables.some(
      (timetable) => timetable.id === workspace.activeTimetableId,
    )
      ? workspace.activeTimetableId
      : timetables[0].id,
    isCompareMode: Boolean(workspace.isCompareMode),
    timetables,
  };
}

export function hasWorkspaceCourses(workspace: TimetableWorkspace): boolean {
  return workspace.timetables.some((timetable) => timetable.courseIds.length > 0);
}

export function filterWorkspaceCourseIds(
  workspace: TimetableWorkspace,
  availableCourseIds: ReadonlySet<string>,
): TimetableWorkspace {
  return normalizeTimetableWorkspace({
    ...workspace,
    timetables: workspace.timetables.map((timetable) => ({
      ...timetable,
      courseIds: timetable.courseIds.filter((courseId) =>
        availableCourseIds.has(courseId),
      ),
    })),
  });
}

function createNextTimetable(
  timetables: TimetableWorkspaceItem[],
  courseIds: string[],
): TimetableWorkspaceItem {
  const usedIds = new Set(timetables.map((timetable) => timetable.id));
  let index = 1;
  while (usedIds.has(`timetable-${index}`)) index += 1;

  return {
    id: `timetable-${index}`,
    courseIds: normalizeCourseIds(courseIds),
  };
}

function normalizeCourseIds(courseIds: string[]): string[] {
  return Array.from(
    new Set(courseIds.map((courseId) => courseId.trim()).filter(Boolean)),
  );
}
