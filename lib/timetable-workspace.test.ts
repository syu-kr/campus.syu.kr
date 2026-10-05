import { describe, expect, it } from "vitest";

import {
  addTimetable,
  createTimetableWorkspace,
  duplicateTimetable,
  enterTimetableCompareMode,
  filterWorkspaceCourseIds,
  leaveTimetableCompareMode,
  MAX_TIMETABLES,
  normalizeTimetableWorkspace,
  removeTimetable,
  toggleTimetableCourse,
} from "@/lib/timetable-workspace";

describe("timetable workspace", () => {
  it("repairs colliding IDs without changing another timetable's courses", () => {
    const workspace = normalizeTimetableWorkspace({
      activeTimetableId: "timetable-2", isCompareMode: true,
      timetables: [
        { id: "timetable-2", courseIds: ["course-a"] },
        { id: "timetable-2", courseIds: ["course-b"] },
        { id: "timetable-3", courseIds: ["course-c"] },
        { id: "", courseIds: ["course-d"] },
      ],
    });
    expect(new Set(workspace.timetables.map((item) => item.id)).size).toBe(4);
    expect(workspace.activeTimetableId).toBe("timetable-2");
    expect(workspace.timetables[2].id).toBe("timetable-3");
    const edited = toggleTimetableCourse(workspace, "timetable-2", "added");
    expect(edited.timetables.map((item) => item.courseIds)).toEqual([
      ["course-a", "added"], ["course-b"], ["course-c"], ["course-d"],
    ]);
  });

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
