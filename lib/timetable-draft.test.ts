import { describe, expect, it } from "vitest";

import {
  createTimetableDraft,
  filterAvailableDraftCourseIds,
  isTimetableDraftForSemester,
  parseTimetableDraft,
  TIMETABLE_DRAFT_TTL_MS,
} from "@/lib/timetable-draft";

const NOW = Date.parse("2026-07-13T00:00:00.000Z");

describe("timetable draft", () => {
  it("creates a normalized, versioned draft", () => {
    expect(
      createTimetableDraft(
        [" course-a ", "course-a", "course-b"],
        " 2026 ",
        " 1 ",
        NOW,
      ),
    ).toEqual({
      version: 1,
      courseIds: ["course-a", "course-b"],
      year: "2026",
      semester: "1",
      updatedAt: "2026-07-13T00:00:00.000Z",
    });
  });

  it("parses a valid draft and rejects expired or malformed data", () => {
    const draft = createTimetableDraft(["course-a"], "2026", "1", NOW);

    expect(parseTimetableDraft(JSON.stringify(draft), NOW)).toEqual(draft);
    expect(
      parseTimetableDraft(
        JSON.stringify(draft),
        NOW + TIMETABLE_DRAFT_TTL_MS + 1,
      ),
    ).toBeNull();
    expect(parseTimetableDraft("not-json", NOW)).toBeNull();
    expect(
      parseTimetableDraft(
        JSON.stringify({ ...draft, version: 2 }),
        NOW,
      ),
    ).toBeNull();
  });

  it("checks semester identity without coercing missing metadata", () => {
    const draft = createTimetableDraft(["course-a"], "2026", "1", NOW);

    expect(isTimetableDraftForSemester(draft, "2026", "1")).toBe(true);
    expect(isTimetableDraftForSemester(draft, "2026", "2")).toBe(false);
    expect(isTimetableDraftForSemester(draft)).toBe(false);
  });

  it("keeps only course ids that still exist in the active dataset", () => {
    const draft = createTimetableDraft(
      ["course-a", "removed-course", "course-b"],
      "2026",
      "1",
      NOW,
    );

    expect(
      filterAvailableDraftCourseIds(
        draft,
        new Set(["course-a", "course-b", "course-c"]),
      ),
    ).toEqual(["course-a", "course-b"]);
  });
});
