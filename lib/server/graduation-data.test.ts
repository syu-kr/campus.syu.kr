import { beforeEach, describe, expect, it, vi } from "vitest";
import { bundledGraduationReference } from "../graduation";
import { createGraduationModel, type GraduationSelection } from "../graduation-model";

const readBundle = vi.hoisted(() => vi.fn());
vi.mock("./public-data", () => ({ readPublicDataBundle: readBundle }));

import { createGraduationClientReference, readGraduationReference } from "./graduation-data";

const original = bundledGraduationReference;
const projected = createGraduationClientReference(original);
const fullModel = createGraduationModel(original);
const clientModel = createGraduationModel(projected);
const years = ["", "0000", "2024", "2026", "9999"];

beforeEach(() => readBundle.mockReset());

describe("graduation client reference", () => {
  it("preserves the source snapshot and all non-course reference objects", () => {
    const before = JSON.stringify(original);
    const reduced = createGraduationClientReference(original);
    expect(JSON.stringify(original)).toBe(before);
    for (const key of ["requirements", "departmentRules", "sources", "selectionRules"] as const) {
      expect(reduced[key]).toBe(original[key]);
    }
    expect(reduced.curriculum.metadata).toBe(original.curriculum.metadata);
    expect(reduced.curriculum).not.toBe(original.curriculum);
    expect(reduced.curriculum.courses.every(course => original.curriculum.courses.includes(course))).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(reduced))).toBeLessThanOrEqual(Buffer.byteLength(before));
  });

  it("keeps the server reader complete and pins all five original files together", async () => {
    readBundle.mockResolvedValue({ data: {
      "graduation-requirements-2026.json": original.requirements,
      "graduation-department-rules.json": original.departmentRules,
      "graduation-sources.json": original.sources,
      "curriculum-courses-2026-verified.json": original.curriculum,
      "curriculum-course-selection-rules-2026.json": original.selectionRules,
    } });
    const snapshot = await readGraduationReference();
    expect(snapshot).toEqual(original);
    expect(snapshot.curriculum.courses).toBe(original.curriculum.courses);
    expect(readBundle).toHaveBeenCalledExactlyOnceWith([
      "graduation-requirements-2026.json", "graduation-department-rules.json", "graduation-sources.json",
      "curriculum-courses-2026-verified.json", "curriculum-course-selection-rules-2026.json",
    ]);
  });

  it("follows the snapshot review metadata instead of a fixed list of departments", () => {
    const previouslyUnavailable = original.requirements.departments.find(department =>
      !fullModel.getVerifiedCurriculumAvailability(department.id, "2026").available &&
      original.curriculum.courses.some(course => course.departmentId === department.id && course.verificationStatus === "humanVerified"),
    )!;
    const reference = {
      ...original,
      curriculum: {
        ...original.curriculum,
        metadata: { ...original.curriculum.metadata, reviewedDepartmentIds: [previouslyUnavailable.id] },
      },
    };
    const reduced = createGraduationClientReference(reference);
    expect(reduced.curriculum.courses.filter(course => course.departmentId === previouslyUnavailable.id))
      .toEqual(original.curriculum.courses.filter(course => course.departmentId === previouslyUnavailable.id));
    const fullyReviewedOnly = createGraduationClientReference({
      ...original,
      curriculum: { ...original.curriculum, metadata: { ...original.curriculum.metadata, reviewedDepartmentIds: undefined } },
    });
    expect(fullyReviewedOnly.curriculum.courses.every(course =>
      original.curriculum.metadata.fullyVerifiedDepartmentIds.includes(course.departmentId),
    )).toBe(true);
  });

  it.each(original.requirements.colleges)("preserves every selection and calculation in $id", college => {
    expect(clientModel.getAvailableDepartments(college.id)).toEqual(fullModel.getAvailableDepartments(college.id));
    for (const department of fullModel.getAvailableDepartments(college.id)) {
      const majors = [undefined, "invalid-major", ...fullModel.getAvailableMajors(department.id).map(major => major.id)];
      expect(clientModel.getAvailableMajors(department.id)).toEqual(fullModel.getAvailableMajors(department.id));
      for (const majorId of majors) {
        const admissions = fullModel.getAvailableAdmissionTypes(department.id, majorId);
        expect(clientModel.getAvailableAdmissionTypes(department.id, majorId)).toEqual(admissions);
        const transfers = fullModel.getAvailableTransferYears(department.id, majorId);
        expect(clientModel.getAvailableTransferYears(department.id, majorId)).toEqual(transfers);
        for (const admissionYear of years) {
          const courses = fullModel.getVerifiedCurriculumCourses(department.id, admissionYear, majorId);
          expect(clientModel.getVerifiedCurriculumCourses(department.id, admissionYear, majorId)).toEqual(courses);
          for (const locale of ["ko", "en"] as const) {
            expect(clientModel.getVerifiedCurriculumAvailability(department.id, admissionYear, locale, majorId))
              .toEqual(fullModel.getVerifiedCurriculumAvailability(department.id, admissionYear, locale, majorId));
          }
          const selectedIds = courses.map(course => course.id);
          expect(clientModel.summarizeSelectedCourses(courses, selectedIds))
            .toEqual(fullModel.summarizeSelectedCourses(courses, selectedIds));
        }
        const courses = fullModel.getVerifiedCurriculumCourses(department.id, "2026", majorId);
        for (const course of courses) {
          expect(clientModel.getMutuallyExclusiveCourseIds(courses, course.id))
            .toEqual(fullModel.getMutuallyExclusiveCourseIds(courses, course.id));
        }
        for (const admissionType of admissions) {
          for (const transferYear of admissionType === "departmentTransfer" ? [undefined, ...transfers] : [undefined]) {
            const tracks = fullModel.getAvailableMajorTracks(department.id, majorId, admissionType, transferYear);
            expect(clientModel.getAvailableMajorTracks(department.id, majorId, admissionType, transferYear)).toEqual(tracks);
            for (const majorTrack of tracks) {
              const selection: GraduationSelection = { collegeId: college.id, departmentId: department.id, majorId, admissionYear: "2026", admissionType, transferYear, majorTrack };
              const requirement = fullModel.resolveRequirement(selection);
              expect(clientModel.resolveRequirement(selection)).toEqual(requirement);
              expect(clientModel.isCompleteSelection(selection)).toBe(fullModel.isCompleteSelection(selection));
              for (const locale of ["ko", "en"] as const) {
                expect(clientModel.evaluateGraduation(requirement, { totalCredits: 120 }, {}, selection, locale))
                  .toEqual(fullModel.evaluateGraduation(requirement, { totalCredits: 120 }, {}, selection, locale));
              }
            }
          }
        }
      }
    }
  });
});
