import { describe, expect, it } from "vitest";
import {
  buildGraduationShareUrl,
  createGraduationSavedState,
  parseGraduationSavedStateFromHash,
  parseGraduationSavedStatePayload,
} from "./graduation-persistence";

const state = createGraduationSavedState(
  {
    admissionYear: "2026",
    collegeId: "college",
    departmentId: "department",
    admissionType: "freshman",
    majorTrack: "single",
  },
  { totalCredits: 120 },
  ["COURSE-1"],
  { chapel: "satisfied" },
  { plan: "졸업 계획" },
);

describe("graduation persistence", () => {
  it("round-trips Unicode saved state through a share URL", () => {
    const url = buildGraduationShareUrl(
      state,
      "https://campus.syu.kr/academic/graduation",
    );

    expect(parseGraduationSavedStateFromHash(new URL(url).hash)).toEqual(
      state,
    );
  });

  it("normalizes untrusted imported fields", () => {
    expect(
      parseGraduationSavedStatePayload({
        selection: {
          admissionYear: "20ab26",
          admissionType: "not-valid",
          majorTrack: "doubleMajor",
        },
        completedCredits: {
          totalCredits: "120",
          majorTotal: -1,
          unexpected: 999,
        },
        selectedCourseIds: ["COURSE-1", "COURSE-1", 123],
        checklistAnswers: {
          chapel: "satisfied",
          invalid: "yes",
        },
        plans: {
          plan: "유지",
          invalid: 123,
        },
      }),
    ).toEqual({
      selection: {
        admissionYear: "2026",
        collegeId: "",
        departmentId: "",
        majorId: undefined,
        admissionType: "",
        majorTrack: "doubleMajor",
      },
      completedCredits: { totalCredits: 120 },
      selectedCourseIds: ["COURSE-1"],
      checklistAnswers: { chapel: "satisfied" },
      plans: { plan: "유지" },
    });
  });

  it("ignores unrelated URL hashes", () => {
    expect(parseGraduationSavedStateFromHash("#section")).toBeNull();
  });
});
