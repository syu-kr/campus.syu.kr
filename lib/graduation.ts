import departmentRuleData from "@/public/data/graduation-department-rules.json";
import curriculumSelectionRuleData from "@/public/data/curriculum-course-selection-rules.json";
import verifiedCurriculumData from "@/public/data/curriculum-courses-2025-verified.json";
import graduationRequirements2025 from "@/public/data/graduation-requirements-2025.json";
import graduationSourceData from "@/public/data/graduation-sources.json";

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
}

interface VerifiedCurriculumData {
  metadata: {
    sourceYear: string;
    generatedAt: string;
    fullyVerifiedDepartmentIds: string[];
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
}

interface CreditEvaluationItem {
  key: CreditCategoryKey | "totalCredits";
  label: string;
  required: number;
  completed: number;
  shortage: number;
  status: "satisfied" | "short";
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

const GRADUATION_DATA = graduationRequirements2025 as GraduationData;
const DEPARTMENT_RULES = departmentRuleData.rules as DepartmentRule[];
const SOURCES = graduationSourceData.sources as GraduationSource[];
const VERIFIED_CURRICULUM = verifiedCurriculumData as VerifiedCurriculumData;
const CURRICULUM_SELECTION_RULES =
  curriculumSelectionRuleData as CurriculumSelectionRuleData;

export const ADMISSION_TYPE_LABELS: Record<AdmissionType, string> = {
  freshman: "신입생",
  transfer2: "2학년 편입",
  transfer3: "3학년 편입",
  transfer4: "4학년 편입",
  departmentTransfer: "전과생",
};

export const MAJOR_TRACK_LABELS: Record<MajorTrack, string> = {
  single: "단일전공",
  doubleMajor: "복수전공",
  minor: "부전공",
  teaching: "교직",
  lifelongEducator: "평생교육사",
};

export const CREDIT_CATEGORY_LABELS: Record<
  CreditCategoryKey | "totalCredits",
  string
> = {
  totalCredits: "총 취득학점",
  requiredLiberal: "교양필수",
  coreLiberal: "핵심교양",
  areaLiberal: "영역별 교양",
  majorRequired: "전공필수",
  majorElective: "전공선택",
  majorTotal: "주전공",
  doubleMajor: "복수전공",
  minor: "부전공",
  teaching: "교직",
  lifelongEducator: "평생교육사",
  freeElective: "자유선택",
};

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
): MajorTrack[] {
  const group = resolveRequirementGroup(departmentId, majorId);
  if (!group || !admissionType) return [];
  return unique(
    GRADUATION_DATA.requirementProfiles
      .filter(
        (profile) =>
          profile.requirementGroup === group &&
          profile.admissionType === admissionType,
      )
      .map((profile) => profile.majorTrack),
  );
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
      profile.majorTrack === selection.majorTrack,
  );
}

export function getInputCreditKeys(
  requirement: RequirementProfile,
): Array<CreditCategoryKey | "totalCredits"> {
  return CREDIT_CATEGORY_ORDER.filter(
    (key) =>
      key === "totalCredits" || Number(requirement.categories[key] ?? 0) > 0,
  );
}

export function getChecklistItems(
  requirement: RequirementProfile | undefined,
  departmentId: string,
): ChecklistItem[] {
  if (!requirement) return [];

  const commonItems = requirement.graduationConditions.map(
    (condition, index) => ({
      id: `common-${requirement.id}-${index}`,
      label: condition,
      sourceIds: ["syu-graduation-guide", "graduation-self-check-sheet"],
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
    "syu-graduation-guide",
    "syu-major-system",
    "graduation-self-check-sheet",
    "syu-2025-handbook",
    ...DEPARTMENT_RULES.filter((rule) => rule.departmentId === departmentId)
      .flatMap((rule) => rule.sourceIds),
  ]);
  return SOURCES.filter((source) => ids.has(source.id));
}

export function getVerifiedCurriculumAvailability(
  departmentId: string,
  admissionYear: string,
) {
  const courses = VERIFIED_CURRICULUM.courses.filter(
    (course) => course.departmentId === departmentId,
  );
  const sourceYear = VERIFIED_CURRICULUM.metadata.sourceYear;
  const fullyVerified =
    VERIFIED_CURRICULUM.metadata.fullyVerifiedDepartmentIds.includes(
      departmentId,
    );

  if (!fullyVerified || courses.length === 0) {
    return {
      available: false,
      sourceYear,
      usesReferenceCurriculum: false,
      courseCount: 0,
      reason: "이 학과는 아직 교육과정 전체 페이지 검증이 완료되지 않았습니다.",
    };
  }

  const usesReferenceCurriculum = admissionYear !== sourceYear;
  return {
    available: true,
    sourceYear,
    usesReferenceCurriculum,
    courseCount: courses.length,
    reason: usesReferenceCurriculum
      ? `${admissionYear}년 입학생도 현재 검증된 ${sourceYear}년 교육과정을 기준으로 과목을 선택할 수 있습니다. 실제 적용 교육과정은 SU-WINGs와 학과사무실에서 반드시 확인하세요.`
      : "",
  };
}

export function getVerifiedCurriculumCourses(
  departmentId: string,
  admissionYear: string,
) {
  const availability = getVerifiedCurriculumAvailability(
    departmentId,
    admissionYear,
  );
  if (!availability.available) return [];

  return VERIFIED_CURRICULUM.courses
    .filter((course) => course.departmentId === departmentId)
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
): GraduationEvaluationResult {
  if (!requirement) {
    return {
      overallStatus: "checkRequired",
      creditItems: [],
      checklistItems: [],
      warnings: ["조건을 모두 선택하면 참고 요건을 확인할 수 있습니다."],
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
      label: CREDIT_CATEGORY_LABELS[key],
      required,
      completed,
      shortage,
      status: shortage > 0 ? ("short" as const) : ("satisfied" as const),
    };
  });

  const checklistItems = getChecklistItems(requirement, selection.departmentId).map(
    (item) => {
      const answer = checklistAnswers[item.id];
      return {
        ...item,
        answer,
        status:
          answer === "satisfied" || answer === "notApplicable"
            ? ("satisfied" as const)
            : answer === "incomplete"
              ? ("short" as const)
              : ("checkRequired" as const),
      };
    },
  );

  const warnings = [
    ...(selection.admissionYear !== GRADUATION_DATA.metadata.sourceYear
      ? [
          `${selection.admissionYear}년 입학생은 현재 ${GRADUATION_DATA.metadata.sourceYear}학년도 요람 참고값과 다를 수 있어 학과 확인이 필요합니다.`,
        ]
      : []),
    ...(selection.admissionType === "transfer3"
      ? [
          "3학년 편입 졸업학점은 자가진단표와 최신 본부 안내 사이에 차이가 있어 SU-WINGs와 학과사무실 확인이 필요합니다.",
        ]
      : []),
    ...(requirement.warnings ?? []),
    ...(getDepartmentById(selection.departmentId)?.warnings ?? []),
  ];
  const statuses = [
    ...creditItems.map((item) => item.status),
    ...checklistItems.map((item) => item.status),
  ];
  const overallStatus = statuses.includes("short")
    ? "short"
    : statuses.includes("checkRequired") || warnings.length > 0
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
      (majors.length === 0 || selection.majorId) &&
      selection.admissionType &&
      selection.majorTrack,
  );
}

function resolveRequirementGroup(departmentId: string, majorId?: string) {
  const department = getDepartmentById(departmentId);
  if (!department) return;
  return (
    department.majors?.find((major) => major.id === majorId)?.requirementGroup ??
    department.requirementGroup
  );
}

function normalizeCredit(value: number | undefined) {
  if (value == null || Number.isNaN(value)) return 0;
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
