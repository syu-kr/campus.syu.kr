import graduationRequirements2025 from "@/public/data/graduation-requirements-2025.json";
import curriculumCourses2025Ocr from "@/public/data/curriculum-courses-2025-ocr.json";

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

export interface GraduationMetadata {
  sourceTitle: string;
  sourceYear: string;
  lastVerifiedAt: string;
  notes: string[];
}

export interface GraduationCollege {
  id: string;
  name: string;
  order: number;
}

export interface GraduationMajor {
  id: string;
  name: string;
  requirementGroup?: string;
}

export interface GraduationDepartment {
  id: string;
  collegeId: string;
  name: string;
  requirementGroup: string;
  sourcePage?: string;
  majors?: GraduationMajor[];
  specialNotes?: string[];
  warnings?: string[];
}

export type CreditCategories = Partial<Record<CreditCategoryKey, number>>;

export interface RequirementProfile {
  id: string;
  requirementGroup: string;
  admissionType: AdmissionType;
  majorTrack: MajorTrack;
  totalCredits: number;
  categories: CreditCategories;
  graduationConditions: string[];
  warnings?: string[];
  sourcePage?: string;
}

export interface GraduationCourse {
  id: string;
  name: string;
  credits: number;
  group?: string;
  note?: string;
}

export type CurriculumCourseCategory = "교필" | "교선" | "전필" | "전선";

export interface CurriculumCourse {
  id: string;
  departmentId?: string | null;
  departmentName?: string;
  majorId?: string | null;
  year?: number;
  semester?: number;
  category: CurriculumCourseCategory;
  name: string;
  credits: number | null;
  theoryCredits?: number;
  practiceCredits?: number;
  courseType?: string;
  passFail?: boolean;
  note?: string;
  sourcePage?: string;
  reviewStatus?: "ocrCleaned" | "needsReview";
}

export interface GraduationData {
  metadata: GraduationMetadata;
  colleges: GraduationCollege[];
  departments: GraduationDepartment[];
  requirementProfiles: RequirementProfile[];
  courseCatalogs?: {
    requiredLiberal?: Partial<Record<AdmissionType, GraduationCourse[]>>;
    areaLiberal?: GraduationCourse[];
    majorRequired?: GraduationCourse[];
  };
  curriculumCourses?: CurriculumCourse[];
  aliases: Record<string, string>;
  comparisonFindings: string[];
}

export interface GraduationSelection {
  collegeId: string;
  departmentId: string;
  majorId?: string;
  admissionType: AdmissionType | "";
  majorTrack: MajorTrack | "";
}

export type CompletedCreditInput = Partial<
  Record<CreditCategoryKey | "totalCredits", number>
>;

export interface CreditEvaluationItem {
  key: CreditCategoryKey | "totalCredits";
  label: string;
  required: number;
  completed: number;
  shortage: number;
  status: EvaluationStatus;
}

export interface ConditionEvaluationItem {
  id: string;
  label: string;
  status: "checkRequired";
}

export interface GraduationEvaluationResult {
  overallStatus: EvaluationStatus;
  creditItems: CreditEvaluationItem[];
  conditionItems: ConditionEvaluationItem[];
  warnings: string[];
  satisfiedCount: number;
  totalCheckCount: number;
}

export const GRADUATION_DATA =
  graduationRequirements2025 as GraduationData;

const OCR_CURRICULUM_COURSES = (
  curriculumCourses2025Ocr as {
    courses?: CurriculumCourse[];
  }
).courses ?? [];

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

const AUTO_TOTAL_KEYS: CreditCategoryKey[] = [
  "requiredLiberal",
  "coreLiberal",
  "areaLiberal",
  "majorTotal",
  "doubleMajor",
  "minor",
  "teaching",
  "lifelongEducator",
  "freeElective",
];

export function getGraduationMetadata(): GraduationMetadata {
  return GRADUATION_DATA.metadata;
}

export function getComparisonFindings(): string[] {
  return GRADUATION_DATA.comparisonFindings;
}

export function getColleges(): GraduationCollege[] {
  return [...GRADUATION_DATA.colleges].sort((a, b) => a.order - b.order);
}

export function getCollegeById(
  collegeId: string,
): GraduationCollege | undefined {
  return GRADUATION_DATA.colleges.find((college) => college.id === collegeId);
}

export function getAvailableDepartments(
  collegeId: string,
): GraduationDepartment[] {
  return GRADUATION_DATA.departments.filter(
    (department) => department.collegeId === collegeId,
  );
}

export function getDepartmentById(
  departmentId: string,
): GraduationDepartment | undefined {
  const resolvedId = GRADUATION_DATA.aliases[departmentId] ?? departmentId;
  return GRADUATION_DATA.departments.find(
    (department) => department.id === resolvedId,
  );
}

export function getAvailableMajors(departmentId: string): GraduationMajor[] {
  return getDepartmentById(departmentId)?.majors ?? [];
}

export function getAvailableAdmissionTypes(
  departmentId: string,
  majorId?: string,
): AdmissionType[] {
  const requirementGroup = resolveRequirementGroup(departmentId, majorId);
  if (!requirementGroup) return [];

  return unique(
    GRADUATION_DATA.requirementProfiles
      .filter((profile) => profile.requirementGroup === requirementGroup)
      .map((profile) => profile.admissionType),
  );
}

export function getAvailableMajorTracks(
  departmentId: string,
  majorId: string | undefined,
  admissionType: AdmissionType | "",
): MajorTrack[] {
  const requirementGroup = resolveRequirementGroup(departmentId, majorId);
  if (!requirementGroup || !admissionType) return [];

  return unique(
    GRADUATION_DATA.requirementProfiles
      .filter(
        (profile) =>
          profile.requirementGroup === requirementGroup &&
          profile.admissionType === admissionType,
      )
      .map((profile) => profile.majorTrack),
  );
}

export function resolveRequirement(
  selection: GraduationSelection,
): RequirementProfile | undefined {
  const requirementGroup = resolveRequirementGroup(
    selection.departmentId,
    selection.majorId,
  );

  if (!requirementGroup || !selection.admissionType || !selection.majorTrack) {
    return undefined;
  }

  return GRADUATION_DATA.requirementProfiles.find(
    (profile) =>
      profile.requirementGroup === requirementGroup &&
      profile.admissionType === selection.admissionType &&
      profile.majorTrack === selection.majorTrack,
  );
}

export function getInputCreditKeys(
  requirement: RequirementProfile,
): Array<CreditCategoryKey | "totalCredits"> {
  return CREDIT_CATEGORY_ORDER.filter((key) => {
    if (key === "totalCredits") return false;
    return Number(requirement.categories[key] ?? 0) > 0;
  });
}

export function getRequiredLiberalCourses(
  admissionType: AdmissionType | "",
): GraduationCourse[] {
  if (!admissionType) return [];
  return GRADUATION_DATA.courseCatalogs?.requiredLiberal?.[admissionType] ?? [];
}

export function getAreaLiberalCourses(): GraduationCourse[] {
  return GRADUATION_DATA.courseCatalogs?.areaLiberal ?? [];
}

export const CURRICULUM_CATEGORY_LABELS: Record<
  CurriculumCourseCategory,
  string
> = {
  교필: "교양필수",
  교선: "교양선택",
  전필: "전공필수",
  전선: "전공선택",
};

export function getCurriculumCourses(
  departmentId: string,
  majorId?: string,
  category?: CurriculumCourseCategory,
): CurriculumCourse[] {
  const resolvedDepartmentId = GRADUATION_DATA.aliases[departmentId] ?? departmentId;

  return uniqueCurriculumCourses([
    ...(GRADUATION_DATA.curriculumCourses ?? []),
    ...OCR_CURRICULUM_COURSES,
  ])
    .filter((course) => course.departmentId === resolvedDepartmentId)
    .filter((course) => !majorId || !course.majorId || course.majorId === majorId)
    .filter((course) => !category || course.category === category)
    .sort((a, b) => {
      if ((a.year ?? 99) !== (b.year ?? 99)) {
        return (a.year ?? 99) - (b.year ?? 99);
      }
      if ((a.semester ?? 99) !== (b.semester ?? 99)) {
        return (a.semester ?? 99) - (b.semester ?? 99);
      }
      return a.name.localeCompare(b.name, "ko");
    });
}

export function getMajorRequiredCourses(
  departmentId?: string,
  majorId?: string,
): GraduationCourse[] {
  if (departmentId) {
    const curriculumCourses = getCurriculumCourses(
      departmentId,
      majorId,
      "전필",
    );

    if (curriculumCourses.length > 0) {
      return curriculumCourses.map((course) => ({
        id: course.id,
        name: course.name,
        credits: course.credits ?? 0,
        group:
          course.year && course.semester
            ? `${course.year}학년 ${course.semester}학기 ${course.category}`
            : "전공필수",
        note: [
          course.courseType,
          course.note,
          course.credits == null ? "학점 확인 필요" : undefined,
          course.reviewStatus === "needsReview" ? "확인 필요" : undefined,
        ]
          .filter(Boolean)
          .join(" · "),
      }));
    }
  }

  return GRADUATION_DATA.courseCatalogs?.majorRequired ?? [];
}

export function calculateAutoTotalCredits(
  completedCredits: CompletedCreditInput,
): number {
  return AUTO_TOTAL_KEYS.reduce(
    (sum, key) => sum + normalizeCredit(completedCredits[key]),
    0,
  );
}

export function evaluateGraduation(
  requirement: RequirementProfile | undefined,
  completedCredits: CompletedCreditInput,
  selection?: GraduationSelection,
): GraduationEvaluationResult {
  if (!requirement) {
    return {
      overallStatus: "checkRequired",
      creditItems: [],
      conditionItems: [],
      warnings: ["선택한 조건에 맞는 2025학년도 졸업요건 데이터를 찾지 못했습니다."],
      satisfiedCount: 0,
      totalCheckCount: 0,
    };
  }

  const creditItems = [
    "totalCredits" as const,
    ...getInputCreditKeys(requirement),
  ].map((key) => {
    const required =
      key === "totalCredits"
        ? requirement.totalCredits
        : Number(requirement.categories[key] ?? 0);
    const completed =
      key === "totalCredits"
        ? calculateAutoTotalCredits(completedCredits)
        : normalizeCredit(completedCredits[key]);
    const shortage = Math.max(required - completed, 0);

    return {
      key,
      label: CREDIT_CATEGORY_LABELS[key],
      required,
      completed,
      shortage,
      status: shortage > 0 ? "short" : "satisfied",
    } satisfies CreditEvaluationItem;
  });

  const conditionItems = requirement.graduationConditions.map(
    (condition, index) => ({
      id: `condition-${index}`,
      label: condition,
      status: "checkRequired" as const,
    }),
  );

  const warnings = getRequirementWarnings(requirement, selection);
  const hasShortage = creditItems.some((item) => item.status === "short");
  const hasCheckRequired = conditionItems.length > 0 || warnings.length > 0;
  const overallStatus = hasShortage
    ? "short"
    : hasCheckRequired
      ? "checkRequired"
      : "satisfied";

  return {
    overallStatus,
    creditItems,
    conditionItems,
    warnings,
    satisfiedCount: creditItems.filter((item) => item.status === "satisfied")
      .length,
    totalCheckCount: creditItems.length + conditionItems.length,
  };
}

export function isCompleteSelection(selection: GraduationSelection): boolean {
  if (!selection.collegeId || !selection.departmentId) return false;
  if (getAvailableMajors(selection.departmentId).length > 0 && !selection.majorId) {
    return false;
  }
  return Boolean(selection.admissionType && selection.majorTrack);
}

export function getRequirementSummary(
  requirement: RequirementProfile | undefined,
): Array<{ key: CreditCategoryKey | "totalCredits"; label: string; value: number }> {
  if (!requirement) return [];

  return getInputCreditKeys(requirement).map((key) => ({
    key,
    label: CREDIT_CATEGORY_LABELS[key],
    value:
      key === "totalCredits"
        ? requirement.totalCredits
        : Number(requirement.categories[key] ?? 0),
  }));
}

function resolveRequirementGroup(
  departmentId: string,
  majorId?: string,
): string | undefined {
  const department = getDepartmentById(departmentId);
  if (!department) return undefined;

  const major = majorId
    ? department.majors?.find((item) => item.id === majorId)
    : undefined;

  return major?.requirementGroup ?? department.requirementGroup;
}

function getRequirementWarnings(
  requirement: RequirementProfile,
  selection?: GraduationSelection,
): string[] {
  const department = selection?.departmentId
    ? getDepartmentById(selection.departmentId)
    : undefined;

  return unique([
    ...(requirement.warnings ?? []),
    ...(department?.warnings ?? []),
    ...(department?.specialNotes ?? []),
  ]);
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function uniqueCurriculumCourses(courses: CurriculumCourse[]): CurriculumCourse[] {
  const seen = new Set<string>();
  const result: CurriculumCourse[] = [];

  for (const course of courses) {
    const key = [
      course.departmentId ?? "",
      course.majorId ?? "",
      course.category,
      course.name.replace(/\s+/g, ""),
    ].join("|");

    if (!seen.has(key)) {
      seen.add(key);
      result.push(course);
    }
  }

  return result;
}

function normalizeCredit(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return 0;
  }

  return value;
}
