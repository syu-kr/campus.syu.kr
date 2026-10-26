import { createGraduationModel, type GraduationReferenceData } from "../graduation-model";
import { readPublicDataBundle } from "./public-data";

export async function readGraduationReference(): Promise<GraduationReferenceData> {
  const { data } = await readPublicDataBundle(["graduation-requirements-2026.json", "graduation-department-rules.json", "graduation-sources.json", "curriculum-courses-2026-verified.json", "curriculum-course-selection-rules-2026.json"]);
  const snapshot = { requirements: data["graduation-requirements-2026.json"], departmentRules: data["graduation-department-rules.json"], sources: data["graduation-sources.json"], curriculum: data["curriculum-courses-2026-verified.json"], selectionRules: data["curriculum-course-selection-rules-2026.json"] } as GraduationReferenceData;
  createGraduationModel(snapshot).getColleges();
  return snapshot;
}
