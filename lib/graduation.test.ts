import { describe, expect, it } from "vitest";
import {
  evaluateGraduation,
  getAvailableAdmissionTypes,
  getAvailableMajors,
  getAvailableTransferYears,
  getChecklistItems,
  getGraduationMetadata,
  getInputCreditKeys,
  getVerifiedCurriculumAvailability,
  getVerifiedCurriculumCourses,
  isCompleteSelection,
  resolveRequirement,
  summarizeSelectedCourses,
  type GraduationSelection,
  type RequirementProfile,
} from "./graduation";

const computerSelection: GraduationSelection = {
  admissionYear: "2026",
  collegeId: "future_fusion",
  departmentId: "ff_computer",
  majorId: "cs_cs",
  admissionType: "freshman",
  majorTrack: "single",
};

const verifiedRequirement: RequirementProfile = {
  id: "required-course-check",
  requirementGroup: "ff_computer",
  admissionType: "freshman",
  majorTrack: "single",
  totalCredits: 3,
  categories: { majorTotal: 3 },
  graduationConditions: ["졸업시험 이수"],
  requiredCourses: ["필수과목 이수"],
  sourcePages: [365],
  verificationStatus: "verified",
};

describe("2026 handbook graduation requirements", () => {
  it("uses the 2026 reference for both current and earlier admission years", () => {
    expect(getGraduationMetadata().sourceYear).toBe("2026");
    const current = resolveRequirement(computerSelection);
    expect(current?.totalCredits).toBe(140);
    expect(resolveRequirement({ ...computerSelection, admissionYear: "2024" }))
      .toEqual(current);
    const result = evaluateGraduation(current, {}, {}, {
      ...computerSelection,
      admissionYear: "2024",
    });
    expect(result.warnings.some((warning) => warning.includes("2024") && warning.includes("2026")))
      .toBe(true);
    expect(result.creditItems.every((item) => item.sourceIds.includes("syu-2026-handbook")))
      .toBe(true);
  });

  it.each([
    ["nursing_nursing", "freshman", "single", 130, 75],
    ["nursing_nursing", "transfer2", "single", 68, 51],
    ["nursing_nursing", "transfer3", "single", 68, 51],
    ["nursing_nursing", "transfer4", "single", 34, 21],
    ["ff_physicaltherapy", "freshman", "single", 130, 75],
    ["ff_computer", "transfer3", "single", 75, 61],
    ["cf_earlychildhood", "freshman", "teaching", 130, 53],
    ["cf_socialwelfare", "freshman", "doubleMajor", 130, 51],
    ["cf_aviation", "freshman", "doubleMajor", 130, 30],
  ] as const)(
    "applies the department table for %s/%s/%s",
    (departmentId, admissionType, majorTrack, totalCredits, majorTotal) => {
      const requirement = resolveRequirement({
        ...computerSelection,
        departmentId,
        majorId: getAvailableMajors(departmentId)[0]?.id,
        admissionType,
        majorTrack,
      });
      expect(requirement?.totalCredits).toBe(totalCredits);
      expect(requirement?.categories.majorTotal).toBe(majorTotal);
      expect(requirement?.sourcePages?.length).toBeGreaterThan(0);
    },
  );

  it("preserves separate pharmacy required and elective major credits", () => {
    const requirement = resolveRequirement({
      ...computerSelection,
      departmentId: "pharmacy_pharm",
      majorId: undefined,
    });
    expect(requirement?.categories).toMatchObject({
      majorRequired: 169,
      majorElective: 32,
      majorTotal: 201,
    });
    expect(resolveRequirement({
      ...computerSelection,
      departmentId: "cf_aviation",
      majorId: "aviation_tourism",
      majorTrack: "doubleMajor",
    })?.categories.doubleMajor).toBe(27);
    expect(getAvailableAdmissionTypes("nursing_nursing")).toContain("transfer2");
  });

  it("requires the department-transfer year before selecting its credit profile", () => {
    const transferSelection: GraduationSelection = {
      ...computerSelection,
      admissionType: "departmentTransfer",
    };
    expect(getAvailableTransferYears("ff_computer", "cs_cs")).toEqual([1, 2, 3, 4]);
    expect(resolveRequirement(transferSelection)).toBeUndefined();
    expect(isCompleteSelection(transferSelection)).toBe(false);
    expect([1, 2, 3, 4].map((transferYear) => resolveRequirement({
      ...transferSelection,
      transferYear,
    })?.categories.majorTotal)).toEqual([85, 73, 61, 61]);
  });

  it("keeps mandatory conditions pending when marked not applicable", () => {
    const checklist = getChecklistItems(verifiedRequirement, "ff_computer");
    expect(checklist.some((item) => item.label === "필수과목 이수")).toBe(true);
    const result = evaluateGraduation(
      verifiedRequirement,
      { totalCredits: 3, majorTotal: 3 },
      Object.fromEntries(checklist.map((item) => [item.id, "notApplicable" as const])),
      computerSelection,
    );
    expect(result.creditItems.every((item) => item.status === "satisfied")).toBe(true);
    expect(result.checklistItems.every((item) => item.status === "checkRequired")).toBe(true);
    expect(result.overallStatus).toBe("checkRequired");
  });

  it("keeps disputed credit fields pending even when entered credits meet the table", () => {
    const requirement: RequirementProfile = {
      ...verifiedRequirement,
      categories: { majorTotal: 3, requiredLiberal: 2 },
      verificationStatus: "needsReview",
      reviewCreditKeys: ["requiredLiberal"],
    };
    const checklist = getChecklistItems(requirement, "ff_computer");
    const result = evaluateGraduation(
      requirement,
      { totalCredits: 3, majorTotal: 3, requiredLiberal: 2 },
      Object.fromEntries(checklist.map((item) => [item.id, "satisfied" as const])),
      computerSelection,
    );
    expect(result.creditItems.find((item) => item.key === "requiredLiberal")?.status)
      .toBe("checkRequired");
    expect(result.creditItems.find((item) => item.key === "totalCredits")?.status)
      .toBe("satisfied");
    expect(result.overallStatus).toBe("checkRequired");
    expect(getInputCreditKeys({ ...requirement, totalCredits: 0 }))
      .not.toContain("totalCredits");
  });

  it("selects only verified common courses and courses belonging to the detailed major", () => {
    const computerCourses = getVerifiedCurriculumCourses("ff_computer", "2026", "cs_cs");
    const softwareCourses = getVerifiedCurriculumCourses("ff_computer", "2026", "cs_sw");
    expect(computerCourses.some((course) => course.majorId === "cs_cs")).toBe(true);
    expect(softwareCourses.some((course) => course.majorId === "cs_sw")).toBe(true);
    expect(computerCourses.every((course) => course.verificationStatus === "humanVerified" &&
      (!course.majorId || course.majorId === "cs_cs"))).toBe(true);
    expect(softwareCourses.every((course) => course.verificationStatus === "humanVerified" &&
      (!course.majorId || course.majorId === "cs_sw"))).toBe(true);
    expect(getVerifiedCurriculumAvailability("ff_computer", "2024", "ko", "cs_cs"))
      .toMatchObject({ available: true, sourceYear: "2026", usesReferenceCurriculum: true });
    expect(getVerifiedCurriculumAvailability("ff_computer", "2026").available).toBe(false);
  });

  it("keeps a disputed credit field pending when input is below its provisional value", () => {
    const requirement: RequirementProfile = {
      ...verifiedRequirement,
      categories: { majorTotal: 3, requiredLiberal: 2 },
      verificationStatus: "needsReview",
      reviewCreditKeys: ["requiredLiberal"],
    };
    const checklist = getChecklistItems(requirement, "ff_computer");
    const result = evaluateGraduation(
      requirement,
      { totalCredits: 3, majorTotal: 3, requiredLiberal: 0 },
      Object.fromEntries(checklist.map((item) => [item.id, "satisfied" as const])),
      computerSelection,
    );
    expect(result.creditItems.find((item) => item.key === "requiredLiberal"))
      .toMatchObject({ shortage: 2, status: "checkRequired" });
    expect(result.overallStatus).toBe("checkRequired");
  });

  it("does not count elective liberal arts courses as required liberal arts", () => {
    const courses = getVerifiedCurriculumCourses("ff_computer", "2026", "cs_cs");
    const electives = courses.filter((course) =>
      course.name.includes("영역별교양선택") || course.name.includes("인성교양영역"),
    );
    expect(electives).toHaveLength(4);
    expect(electives.every((course) => course.category === "교선")).toBe(true);
    const summary = summarizeSelectedCourses(courses, electives.map((course) => course.id));
    expect(summary.totalCredits).toBe(10);
    expect(summary.suggestedCredits.requiredLiberal).toBe(0);
  });

  it("counts one ten-credit pharmacy intensive practice when multiple alternatives are selected", () => {
    const courses = getVerifiedCurriculumCourses("pharmacy_pharm", "2026");
    const alternatives = courses.filter((course) => course.name.includes("심화실무실습"));
    expect(alternatives).toHaveLength(5);
    const summary = summarizeSelectedCourses(courses, alternatives.map((course) => course.id));
    expect(summary.courseCount).toBe(5);
    expect(summary.countedCourseCount).toBe(1);
    expect(summary.totalCredits).toBe(10);
    expect(summary.conflicts).toHaveLength(1);
  });
});
