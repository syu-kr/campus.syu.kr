import { describe, expect, it } from "vitest";

import {
  getRepresentativeCourseIds,
  parseSharedTimetableWorkspace,
  toStoredTimetableWorkspace,
} from "@/lib/timetable-share";

const workspace = {
  activeTimetableId: "timetable-2",
  isCompareMode: true,
  timetables: [
    { id: "timetable-1", courseIds: ["course-a", "course-b"] },
    { id: "timetable-2", courseIds: ["course-b", "course-c"] },
  ],
};

describe("timetable share contract", () => {
  it("round-trips the stored Firestore representation", () => {
    expect(parseSharedTimetableWorkspace(toStoredTimetableWorkspace(workspace)))
      .toEqual(workspace);
  });

  it("uses the active timetable as the legacy representative", () => {
    expect(getRepresentativeCourseIds(workspace)).toEqual([
      "course-b",
      "course-c",
    ]);
  });

  it("falls back to the first populated timetable", () => {
    expect(
      getRepresentativeCourseIds({
        ...workspace,
        timetables: [
          { id: "timetable-1", courseIds: ["course-a"] },
          { id: "timetable-2", courseIds: [] },
        ],
      }),
    ).toEqual(["course-a"]);
  });

  it("rejects an empty, oversized, or malformed workspace", () => {
    expect(
      parseSharedTimetableWorkspace({
        activeTimetableId: "timetable-1",
        isCompareMode: true,
        timetables: [{ id: "timetable-1", courseIds: [] }],
      }),
    ).toBeNull();
    expect(
      parseSharedTimetableWorkspace({
        activeTimetableId: "timetable-1",
        isCompareMode: true,
        timetables: Array.from({ length: 5 }, (_, index) => ({
          id: `timetable-${index + 1}`,
          courseIds: ["course-a"],
        })),
      }),
    ).toBeNull();
    expect(
      parseSharedTimetableWorkspace({
        activeTimetableId: "timetable-1",
        isCompareMode: true,
        timetables: [{ id: "timetable-1", courseIds: [123] }],
      }),
    ).toBeNull();
  });
});
