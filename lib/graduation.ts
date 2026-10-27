import departmentRuleData from "@/public/data/graduation-department-rules.json";
import curriculumSelectionRuleData from "@/public/data/curriculum-course-selection-rules-2026.json";
import verifiedCurriculumData from "@/public/data/curriculum-courses-2026-verified.json";
import graduationRequirements2026 from "@/public/data/graduation-requirements-2026.json";
import graduationSourceData from "@/public/data/graduation-sources.json";
import { createGraduationModel, type GraduationReferenceData } from "./graduation-model";
export * from "./graduation-model";

export const bundledGraduationReference: GraduationReferenceData = { requirements: graduationRequirements2026, departmentRules: departmentRuleData, sources: graduationSourceData, curriculum: verifiedCurriculumData, selectionRules: curriculumSelectionRuleData } as GraduationReferenceData;
export const { getGraduationMetadata, getAvailableMajors, getAvailableAdmissionTypes, getAvailableTransferYears, resolveRequirement, getInputCreditKeys, getChecklistItems, getVerifiedCurriculumAvailability, getVerifiedCurriculumCourses, summarizeSelectedCourses, evaluateGraduation, isCompleteSelection } = createGraduationModel(bundledGraduationReference);
