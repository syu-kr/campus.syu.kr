import type {
  ChecklistAnswer,
  CompletedCreditInput,
  GraduationSelection,
} from "@/lib/graduation";
import type { Dictionary } from "@/lib/i18n";

export const GRADUATION_STORAGE_KEY =
  "syu-campus-graduation-self-check-v2";
export const MOBILE_DESKTOP_NOTICE_KEY =
  "syu-campus-graduation-mobile-desktop-notice-v1";
export const EXPORT_FILE_VERSION = 2;
export const SHARE_HASH_PREFIX = "graduation-progress=";

export const INITIAL_GRADUATION_SELECTION: GraduationSelection = {
  admissionYear: "",
  collegeId: "",
  departmentId: "",
  majorId: undefined,
  admissionType: "",
  majorTrack: "",
};

export interface GraduationSavedState {
  selection: GraduationSelection;
  completedCredits: CompletedCreditInput;
  selectedCourseIds?: string[];
  checklistAnswers: Record<string, ChecklistAnswer>;
  plans: Record<string, string>;
}

export interface ExportedGraduationSavedState {
  app: "syu-campus";
  feature: "graduation-self-check";
  version: number;
  exportedAt: string;
  state: GraduationSavedState;
}

const VALID_ADMISSION_TYPES = [
  "freshman",
  "transfer2",
  "transfer3",
  "transfer4",
  "departmentTransfer",
] as const;
const VALID_MAJOR_TRACKS = [
  "single",
  "doubleMajor",
  "minor",
  "teaching",
  "lifelongEducator",
] as const;
const VALID_CREDIT_KEYS = [
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
] as const;
const VALID_CHECKLIST_ANSWERS = [
  "satisfied",
  "incomplete",
  "notApplicable",
] as const;

type GraduationText = Dictionary["pages"]["graduation"];

export function getCourseCategoryLabel(
  text: GraduationText,
  category: string,
) {
  return (
    text.courseCategories[category as keyof typeof text.courseCategories] ??
    category
  );
}

export function createGraduationSavedState(
  selection: GraduationSelection,
  completedCredits: CompletedCreditInput,
  selectedCourseIds: string[],
  checklistAnswers: Record<string, ChecklistAnswer>,
  plans: Record<string, string>,
): GraduationSavedState {
  return {
    selection,
    completedCredits,
    selectedCourseIds,
    checklistAnswers,
    plans,
  };
}

export function parseGraduationSavedStateFromHash(
  hash: string,
): GraduationSavedState | null {
  const value = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!value.startsWith(SHARE_HASH_PREFIX)) return null;

  return parseGraduationSavedStatePayload(
    JSON.parse(decodeSharePayload(value.slice(SHARE_HASH_PREFIX.length))),
  );
}

export function buildGraduationShareUrl(
  state: GraduationSavedState,
  currentHref = window.location.href,
) {
  const url = new URL(currentHref);
  const payload: ExportedGraduationSavedState = {
    app: "syu-campus",
    feature: "graduation-self-check",
    version: EXPORT_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    state,
  };

  url.hash = `${SHARE_HASH_PREFIX}${encodeSharePayload(payload)}`;
  return url.toString();
}

export function parseGraduationSavedStatePayload(
  payload: unknown,
): GraduationSavedState {
  const candidate =
    isRecord(payload) && isRecord(payload.state) ? payload.state : payload;

  if (!isRecord(candidate)) {
    throw new Error("Invalid graduation saved state");
  }

  return {
    selection: normalizeSelection(candidate.selection),
    completedCredits: normalizeCompletedCredits(candidate.completedCredits),
    selectedCourseIds: normalizeStringArray(candidate.selectedCourseIds),
    checklistAnswers: normalizeChecklistAnswers(candidate.checklistAnswers),
    plans: normalizeStringRecord(candidate.plans),
  };
}

function encodeSharePayload(payload: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeSharePayload(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

function normalizeSelection(value: unknown): GraduationSelection {
  const record = isRecord(value) ? value : {};
  const admissionType = readUnion(record.admissionType, VALID_ADMISSION_TYPES);
  const majorTrack = readUnion(record.majorTrack, VALID_MAJOR_TRACKS);
  const majorId = readString(record.majorId);

  return {
    admissionYear: readString(record.admissionYear).replace(/\D/g, "").slice(0, 4),
    collegeId: readString(record.collegeId),
    departmentId: readString(record.departmentId),
    majorId: majorId || undefined,
    admissionType: admissionType ?? "",
    majorTrack: majorTrack ?? "",
  };
}

function normalizeCompletedCredits(value: unknown): CompletedCreditInput {
  const record = isRecord(value) ? value : {};
  const credits: CompletedCreditInput = {};

  VALID_CREDIT_KEYS.forEach((key) => {
    const credit = Number(record[key]);
    if (Number.isFinite(credit) && credit >= 0) {
      credits[key] = credit;
    }
  });

  return credits;
}

function normalizeChecklistAnswers(value: unknown) {
  const record = isRecord(value) ? value : {};
  const answers: Record<string, ChecklistAnswer> = {};

  Object.entries(record).forEach(([key, answer]) => {
    const normalized = readUnion(answer, VALID_CHECKLIST_ANSWERS);
    if (normalized) {
      answers[key] = normalized;
    }
  });

  return answers;
}

function normalizeStringRecord(value: unknown) {
  const record = isRecord(value) ? value : {};

  return Object.fromEntries(
    Object.entries(record).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function normalizeStringArray(value: unknown) {
  return Array.from(
    new Set(
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [],
    ),
  );
}

function readUnion<T extends readonly string[]>(
  value: unknown,
  candidates: T,
): T[number] | undefined {
  return typeof value === "string" && candidates.includes(value)
    ? value
    : undefined;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
