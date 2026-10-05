import departmentRuleData from "@/public/data/graduation-department-rules.json";
import curriculumSelectionRuleData from "@/public/data/curriculum-course-selection-rules-2026.json";
import verifiedCurriculumData from "@/public/data/curriculum-courses-2026-verified.json";
import graduationRequirements2026 from "@/public/data/graduation-requirements-2026.json";
import graduationSourceData from "@/public/data/graduation-sources.json";
import {
  DEFAULT_LOCALE,
  getDictionary,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n";

export type AdmissionType =
  | "freshman"
  | "transfer2"
  | "transfer3"
  | "transfer4"
  | "departmentTransfer";

export type MajorTrack =
  | "single"
  | "doubleMajor"
  | "minor"
  | "teaching"
  | "lifelongEducator";

export type CreditCategoryKey =
  | "requiredLiberal"
  | "coreLiberal"
  | "areaLiberal"
  | "majorRequired"
  | "majorElective"
  | "majorTotal"
  | "doubleMajor"
  | "minor"
  | "teaching"
  | "lifelongEducator"
  | "freeElective";

export type EvaluationStatus = "satisfied" | "short" | "checkRequired";
export type ChecklistAnswer = "satisfied" | "incomplete" | "notApplicable";

export interface GraduationCollege {
  id: string;
  name: string;
  order: number;
}

interface GraduationMajor {
  id: string;
  name: string;
  requirementGroup?: string;
}

interface GraduationDepartment {
  id: string;
  collegeId: string;
  name: string;
  requirementGroup: string;
  majors?: GraduationMajor[];
  specialNotes?: string[];
  warnings?: string[];
}

type CreditCategories = Partial<Record<CreditCategoryKey, number>>;

export interface RequirementProfile {
  id: string;
  requirementGroup: string;
  admissionType: AdmissionType;
  majorTrack: MajorTrack;
  totalCredits: number;
  categories: CreditCategories;
  graduationConditions: string[];
  requiredCourses?: string[];
  transferYear?: number;
  sourcePages?: number[];
  verificationStatus?: "verified" | "needsReview";
  reviewCreditKeys?: Array<CreditCategoryKey | "totalCredits">;
  warnings?: string[];
}

interface GraduationData {
  metadata: {
    sourceTitle: string;
    sourceYear: string;
    lastVerifiedAt: string;
    notes: string[];
  };
  colleges: GraduationCollege[];
  departments: GraduationDepartment[];
  requirementProfiles: RequirementProfile[];
  aliases: Record<string, string>;
}

interface GraduationSource {
  id: string;
  title: string;
  url?: string;
  publisher: string;
  verifiedAt: string;
  scope: string;
}

interface DepartmentRule {
  id: string;
  departmentId: string;
  label: string;
  description: string;
  sourceIds: string[];
  verificationStatus: "verified" | "needsReview";
  sourceYear?: string;
}

export interface VerifiedCurriculumCourse {
  id: string;
  departmentId: string;
  departmentName: string;
  category: string;
  name: string;
  credits: number;
  year: number;
  semester: number;
  majorId?: string | null;
  verificationStatus?: "humanVerified" | "needsReview";
  sourcePages?: number[];
}

interface VerifiedCurriculumData {
  metadata: {
    sourceYear: string;
    generatedAt: string;
    fullyVerifiedDepartmentIds: string[];
    reviewedDepartmentIds?: string[];
  };
  courses: VerifiedCurriculumCourse[];
}

interface CurriculumSelectionRuleData {
  exclusiveGroups: Array<{
    id: string;
    departmentId: string;
    label: string;
    courseIds: string[];
  }>;
}

export interface CurriculumSelectionSummary {
  courseCount: number;
  countedCourseCount: number;
  totalCredits: number;
  categoryCredits: Record<string, number>;
  suggestedCredits: CompletedCreditInput;
  conflicts: Array<{
    groupLabel: string;
    courseIds: string[];
    courseNames: string[];
  }>;
}

export interface GraduationSelection {
  admissionYear: string;
  collegeId: string;
  departmentId: string;
  majorId?: string;
  admissionType: AdmissionType | "";
  majorTrack: MajorTrack | "";
  transferYear?: number;
}

export type CompletedCreditInput = Partial<
  Record<CreditCategoryKey | "totalCredits", number>
>;

export interface ChecklistItem {
  id: string;
  label: string;
  description?: string;
  sourceIds: string[];
  verificationStatus: "verified" | "needsReview";
  sourcePages?: number[];
}

interface CreditEvaluationItem {
  key: CreditCategoryKey | "totalCredits";
  label: string;
  required: number;
  completed: number;
  shortage: number;
  sourceIds: string[];
  sourcePages?: number[];
  status: EvaluationStatus;
}

interface ChecklistEvaluationItem extends ChecklistItem {
  answer?: ChecklistAnswer;
  status: EvaluationStatus;
}

export interface GraduationEvaluationResult {
  overallStatus: EvaluationStatus;
  creditItems: CreditEvaluationItem[];
  checklistItems: ChecklistEvaluationItem[];
  warnings: string[];
  satisfiedCount: number;
  totalCheckCount: number;
}

const GRADUATION_DATA = graduationRequirements2026 as GraduationData;
const DEPARTMENT_RULES = (departmentRuleData.rules as DepartmentRule[]).filter(
  (rule) => rule.sourceYear === GRADUATION_DATA.metadata.sourceYear,
);
const SOURCES = graduationSourceData.sources as GraduationSource[];
const VERIFIED_CURRICULUM = verifiedCurriculumData as VerifiedCurriculumData;
const CURRICULUM_SELECTION_RULES =
  curriculumSelectionRuleData as CurriculumSelectionRuleData;

const CREDIT_CATEGORY_ORDER: Array<CreditCategoryKey | "totalCredits"> = [
  "totalCredits",
  "requiredLiberal",
  "coreLiberal",
  "areaLiberal",
  "majorRequired",
  "majorElective",
  "majorTotal",
  "doubleMajor",
  "minor",
  "teaching",
  "lifelongEducator",
  "freeElective",
];

export function getGraduationMetadata() {
  return GRADUATION_DATA.metadata;
}

export function getColleges(): GraduationCollege[] {
  return [...GRADUATION_DATA.colleges].sort((a, b) => a.order - b.order);
}

export function getCollegeById(collegeId: string) {
  return GRADUATION_DATA.colleges.find((college) => college.id === collegeId);
}

export function getAvailableDepartments(collegeId: string) {
  return GRADUATION_DATA.departments.filter(
    (department) => department.collegeId === collegeId,
  );
}

export function getDepartmentById(departmentId: string) {
  const resolvedId = GRADUATION_DATA.aliases[departmentId] ?? departmentId;
  return GRADUATION_DATA.departments.find(
    (department) => department.id === resolvedId,
  );
}

export function getAvailableMajors(departmentId: string) {
  return getDepartmentById(departmentId)?.majors ?? [];
}

export function getAvailableAdmissionTypes(
  departmentId: string,
  majorId?: string,
): AdmissionType[] {
  const group = resolveRequirementGroup(departmentId, majorId);
  if (!group) return [];
  return unique(
    GRADUATION_DATA.requirementProfiles
      .filter((profile) => profile.requirementGroup === group)
      .map((profile) => profile.admissionType),
  );
}

export function getAvailableMajorTracks(
  departmentId: string,
  majorId: string | undefined,
  admissionType: AdmissionType | "",
  transferYear?: number,
): MajorTrack[] {
  const group = resolveRequirementGroup(departmentId, majorId);
  if (!group || !admissionType) return [];
  return unique(
    GRADUATION_DATA.requirementProfiles
      .filter(
        (profile) =>
          profile.requirementGroup === group &&
          profile.admissionType === admissionType &&
          (profile.transferYear === undefined || profile.transferYear === transferYear),
      )
      .map((profile) => profile.majorTrack),
  );
}

export function getAvailableTransferYears(departmentId: string, majorId?: string) {
  const group = resolveRequirementGroup(departmentId, majorId);
  return unique(
    GRADUATION_DATA.requirementProfiles
      .filter((profile) => profile.requirementGroup === group && profile.admissionType === "departmentTransfer")
      .flatMap((profile) => profile.transferYear === undefined ? [] : [profile.transferYear]),
  ).sort((a, b) => a - b);
}

export function resolveRequirement(
  selection: GraduationSelection,
): RequirementProfile | undefined {
  const group = resolveRequirementGroup(
    selection.departmentId,
    selection.majorId,
  );
  if (!group || !selection.admissionType || !selection.majorTrack) return;

  return GRADUATION_DATA.requirementProfiles.find(
    (profile) =>
      profile.requirementGroup === group &&
      profile.admissionType === selection.admissionType &&
      profile.majorTrack === selection.majorTrack &&
      (profile.transferYear === undefined || profile.transferYear === selection.transferYear),
  );
}

export function getInputCreditKeys(
  requirement: RequirementProfile,
): Array<CreditCategoryKey | "totalCredits"> {
  return CREDIT_CATEGORY_ORDER.filter(
    (key) =>
      key === "totalCredits" ? requirement.totalCredits > 0 : Number(requirement.categories[key] ?? 0) > 0,
  );
}

export function getChecklistItems(
  requirement: RequirementProfile | undefined,
  departmentId: string,
): ChecklistItem[] {
  if (!requirement) return [];

  const commonItems = [...requirement.graduationConditions, ...(requirement.requiredCourses ?? [])].map(
    (condition, index) => ({
      id: `common-${requirement.id}-${index}`,
      label: condition,
      sourceIds: ["syu-2026-handbook"],
      sourcePages: requirement.sourcePages,
      verificationStatus: "verified" as const,
    }),
  );
  const departmentItems = DEPARTMENT_RULES.filter(
    (rule) => rule.departmentId === departmentId,
  );

  return [...commonItems, ...departmentItems];
}

export function getSourcesForSelection(departmentId: string) {
  const ids = new Set([
    "syu-2026-handbook",
    ...DEPARTMENT_RULES.filter((rule) => rule.departmentId === departmentId)
      .flatMap((rule) => rule.sourceIds),
  ]);
  return SOURCES.filter((source) => ids.has(source.id));
}

export function getVerifiedCurriculumAvailability(
  departmentId: string,
  admissionYear: string,
  locale: Locale = DEFAULT_LOCALE,
  majorId?: string,
) {
  const text = getDictionary(normalizeLocale(locale)).pages.graduation;
  if (getAvailableMajors(departmentId).length > 0 &&
    !getAvailableMajors(departmentId).some((major) => major.id === majorId)) {
    return {
      available: false,
      sourceYear: VERIFIED_CURRICULUM.metadata.sourceYear,
      usesReferenceCurriculum: false,
      courseCount: 0,
      reason: text.courses.majorFirstReason,
    };
  }
  const departmentCourses = VERIFIED_CURRICULUM.courses.filter(
    (course) => course.departmentId === departmentId && (!course.majorId || course.majorId === majorId),
  );
  const courses = departmentCourses.filter((course) => course.verificationStatus === "humanVerified");
  const sourceYear = VERIFIED_CURRICULUM.metadata.sourceYear;
  const fullyVerified =
    VERIFIED_CURRICULUM.metadata.fullyVerifiedDepartmentIds.includes(
      departmentId,
    );

  const reviewed = fullyVerified || VERIFIED_CURRICULUM.metadata.reviewedDepartmentIds?.includes(departmentId);
  if (!reviewed || courses.length === 0) {
    return {
      available: false,
      sourceYear,
      usesReferenceCurriculum: false,
      courseCount: 0,
      reason: text.courses.unavailableReason,
    };
  }

  const usesReferenceCurriculum = admissionYear !== sourceYear;
  const pendingCount = departmentCourses.length - courses.length;
  return {
    available: true,
    sourceYear,
    usesReferenceCurriculum,
    courseCount: courses.length,
    reason: [usesReferenceCurriculum
      ? text.courses.referenceReason
          .replace("{admissionYear}", admissionYear)
          .replace("{sourceYear}", sourceYear)
      : "", pendingCount > 0 ? text.courses.partialReviewReason.replace("{count}", String(pendingCount)) : ""]
      .filter(Boolean).join(" "),
  };
}

export function getVerifiedCurriculumCourses(
  departmentId: string,
  admissionYear: string,
  majorId?: string,
) {
  const availability = getVerifiedCurriculumAvailability(
    departmentId,
    admissionYear,
    DEFAULT_LOCALE,
    majorId,
  );
  if (!availability.available) return [];

  return VERIFIED_CURRICULUM.courses
    .filter((course) => isEligibleCourse(course, departmentId, majorId))
    .sort(
      (a, b) =>
        a.year - b.year ||
        a.semester - b.semester ||
        a.category.localeCompare(b.category, "ko") ||
        a.name.localeCompare(b.name, "ko"),
    );
}

export function summarizeSelectedCourses(
  courses: VerifiedCurriculumCourse[],
  selectedCourseIds: string[],
): CurriculumSelectionSummary {
  const selectedIds = new Set(selectedCourseIds);
  const selectedCourses = courses.filter((course) => selectedIds.has(course.id));
  const selectedGroups = new Map<string, VerifiedCurriculumCourse[]>();
  const countedCourses: VerifiedCurriculumCourse[] = [];
  const conflicts: CurriculumSelectionSummary["conflicts"] = [];

  for (const course of selectedCourses) {
    const group = getCourseSelectionGroup(course);
    if (!group) {
      countedCourses.push(course);
      continue;
    }
    selectedGroups.set(group.key, [...(selectedGroups.get(group.key) ?? []), course]);
  }
  for (const [groupKey, groupCourses] of selectedGroups) {
    countedCourses.push(groupCourses[0]);
    if (groupCourses.length > 1) {
      conflicts.push({
        groupLabel: getCourseSelectionGroup(groupCourses[0])?.label ?? groupKey,
        courseIds: groupCourses.map((course) => course.id),
        courseNames: groupCourses.map(
          (course) => `${course.name} (${course.year}-${course.semester})`,
        ),
      });
    }
  }

  const categoryCredits: Record<string, number> = {};

  for (const course of countedCourses) {
    categoryCredits[course.category] =
      (categoryCredits[course.category] ?? 0) + course.credits;
  }

  const majorRequired = categoryCredits["전필"] ?? 0;
  const majorElective = categoryCredits["전선"] ?? 0;

  return {
    courseCount: selectedCourses.length,
    countedCourseCount: countedCourses.length,
    totalCredits: countedCourses.reduce(
      (total, course) => total + course.credits,
      0,
    ),
    categoryCredits,
    suggestedCredits: {
      totalCredits: countedCourses.reduce(
        (total, course) => total + course.credits,
        0,
      ),
      requiredLiberal: categoryCredits["교필"] ?? 0,
      majorRequired,
      majorElective,
      majorTotal: majorRequired + majorElective,
    },
    conflicts,
  };
}

export function getMutuallyExclusiveCourseIds(
  courses: VerifiedCurriculumCourse[],
  courseId: string,
) {
  const selectedCourse = courses.find((course) => course.id === courseId);
  if (!selectedCourse) return [];
  const selectedGroup = getCourseSelectionGroup(selectedCourse);
  if (!selectedGroup) return [];

  return courses
    .filter(
      (course) =>
        course.id !== courseId &&
        getCourseSelectionGroup(course)?.key === selectedGroup.key,
    )
    .map((course) => course.id);
}

export function evaluateGraduation(
  requirement: RequirementProfile | undefined,
  completedCredits: CompletedCreditInput,
  checklistAnswers: Record<string, ChecklistAnswer>,
  selection: GraduationSelection,
  locale: Locale = DEFAULT_LOCALE,
): GraduationEvaluationResult {
  const text = getDictionary(normalizeLocale(locale)).pages.graduation;

  if (!requirement) {
    return {
      overallStatus: "checkRequired",
      creditItems: [],
      checklistItems: [],
      warnings: [text.result.selectAllConditionsWarning],
      satisfiedCount: 0,
      totalCheckCount: 0,
    };
  }

  const creditItems = getInputCreditKeys(requirement).map((key) => {
    const required =
      key === "totalCredits"
        ? requirement.totalCredits
        : Number(requirement.categories[key] ?? 0);
    const completed = normalizeCredit(completedCredits[key]);
    const shortage = Math.max(required - completed, 0);
    return {
      key,
      label: text.creditCategories[key],
      required,
      completed,
      shortage,
      sourceIds: ["syu-2026-handbook"],
      sourcePages: requirement.sourcePages,
      status: requirement.verificationStatus === "needsReview" &&
          (!requirement.reviewCreditKeys || requirement.reviewCreditKeys.includes(key))
          ? ("checkRequired" as const)
          : shortage > 0 ? ("short" as const) : ("satisfied" as const),
    };
  });

  const checklistItems = getChecklistItems(requirement, selection.departmentId).map(
    (item) => {
      const answer = checklistAnswers[item.id];
      return {
        ...item,
        answer,
        status:
          answer === "incomplete" ? ("short" as const)
            : answer === "satisfied" && item.verificationStatus === "verified"
              ? ("satisfied" as const) : ("checkRequired" as const),
      };
    },
  );

  const warnings = [
    ...(selection.admissionYear !== GRADUATION_DATA.metadata.sourceYear
      ? [
          text.result.admissionYearWarning
            .replace("{admissionYear}", selection.admissionYear)
            .replace("{sourceYear}", GRADUATION_DATA.metadata.sourceYear),
        ]
      : []),
    ...(["transfer2", "transfer3", "transfer4"].includes(selection.admissionType)
      ? [text.result.transfer3Warning]
      : []),
    ...(requirement.warnings ?? []),
    ...(requirement.verificationStatus === "needsReview" ? [text.result.sourceReviewWarning] : []),
    ...(getDepartmentById(selection.departmentId)?.warnings ?? []),
  ];
  const statuses = [
    ...creditItems.map((item) => item.status),
    ...checklistItems.map((item) => item.status),
  ];
  const overallStatus = statuses.includes("short")
    ? "short"
    : statuses.includes("checkRequired") || warnings.length > 0 || requirement.verificationStatus === "needsReview"
      ? "checkRequired"
      : "satisfied";

  return {
    overallStatus,
    creditItems,
    checklistItems,
    warnings,
    satisfiedCount: statuses.filter((status) => status === "satisfied").length,
    totalCheckCount: statuses.length,
  };
}

export function isCompleteSelection(selection: GraduationSelection) {
  const majors = getAvailableMajors(selection.departmentId);
  return Boolean(
    selection.admissionYear &&
      selection.collegeId &&
      selection.departmentId &&
      getDepartmentById(selection.departmentId)?.collegeId === selection.collegeId &&
      (majors.length === 0 || majors.some((major) => major.id === selection.majorId)) &&
      selection.admissionType &&
      selection.majorTrack &&
      resolveRequirement(selection),
  );
}

function isEligibleCourse(course: VerifiedCurriculumCourse, departmentId: string, majorId?: string) {
  return course.departmentId === departmentId &&
    course.verificationStatus === "humanVerified" &&
    (!course.majorId || course.majorId === majorId);
}

function resolveRequirementGroup(departmentId: string, majorId?: string) {
  const department = getDepartmentById(departmentId);
  if (!department) return;
  if (department.majors?.length && !department.majors.some((major) => major.id === majorId)) return;
  return (
    department.majors?.find((major) => major.id === majorId)?.requirementGroup ??
    department.requirementGroup
  );
}

function normalizeCredit(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(value, 0);
}

function getCourseSelectionGroup(course: VerifiedCurriculumCourse) {
  const group = CURRICULUM_SELECTION_RULES.exclusiveGroups.find(
    (candidate) =>
      candidate.departmentId === course.departmentId &&
      candidate.courseIds.includes(course.id),
  );
  if (!group) return;
  return { key: group.id, label: group.label };
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}
