import { describe, expect, it } from "vitest";

import {
  addTimetable,
  createTimetableWorkspace,
  duplicateTimetable,
  enterTimetableCompareMode,
  filterWorkspaceCourseIds,
  leaveTimetableCompareMode,
  MAX_TIMETABLES,
  removeTimetable,
  toggleTimetableCourse,
} from "@/lib/timetable-workspace";

describe("timetable workspace", () => {
  it("starts comparison with the current timetable and an empty alternative", () => {
    const workspace = enterTimetableCompareMode(
      createTimetableWorkspace(["course-a"]),
    );

    expect(workspace.isCompareMode).toBe(true);
    expect(workspace.timetables).toEqual([
      { id: "timetable-1", courseIds: ["course-a"] },
      { id: "timetable-2", courseIds: [] },
    ]);
  });

  it("keeps alternatives when returning to single mode", () => {
    const comparison = enterTimetableCompareMode(
      createTimetableWorkspace(["course-a"]),
    );
    const workspace = leaveTimetableCompareMode(comparison);

    expect(workspace.isCompareMode).toBe(false);
    expect(workspace.timetables).toHaveLength(2);
  });

  it("duplicates an alternative and limits the workspace to four timetables", () => {
    let workspace = enterTimetableCompareMode(
      createTimetableWorkspace(["course-a", "course-b"]),
    );
    workspace = duplicateTimetable(workspace, "timetable-1");
    workspace = addTimetable(workspace);
    workspace = addTimetable(workspace);

    expect(workspace.timetables).toHaveLength(MAX_TIMETABLES);
    expect(workspace.timetables[2].courseIds).toEqual([
      "course-a",
      "course-b",
    ]);
  });

  it("toggles the same course independently in multiple timetables", () => {
    let workspace = enterTimetableCompareMode(createTimetableWorkspace());
    workspace = toggleTimetableCourse(workspace, "timetable-1", "course-a");
    workspace = toggleTimetableCourse(workspace, "timetable-2", "course-a");
    workspace = toggleTimetableCourse(workspace, "timetable-1", "course-a");

    expect(workspace.timetables[0].courseIds).toEqual([]);
    expect(workspace.timetables[1].courseIds).toEqual(["course-a"]);
  });

  it("does not remove alternatives below the comparison minimum", () => {
    const workspace = enterTimetableCompareMode(createTimetableWorkspace());
    expect(removeTimetable(workspace, "timetable-2")).toEqual(workspace);
  });

  it("filters unavailable courses without collapsing alternatives", () => {
    let workspace = enterTimetableCompareMode(
      createTimetableWorkspace(["course-a", "removed-course"]),
    );
    workspace = toggleTimetableCourse(workspace, "timetable-2", "course-b");

    expect(
      filterWorkspaceCourseIds(
        workspace,
        new Set(["course-a", "course-b"]),
      ),
    ).toEqual({
      activeTimetableId: "timetable-1",
      isCompareMode: true,
      timetables: [
        { id: "timetable-1", courseIds: ["course-a"] },
        { id: "timetable-2", courseIds: ["course-b"] },
      ],
    });
  });
});
