import type { RoommateHabits, RoommatePostFilters, RoommatePostInput, RoommateReportInput } from "@/types/roommates";

export const DAY_MS = 86_400_000;
export const ROOMMATE_SESSION_COOKIE = "__Host-roommates_session";

export function areRoommatesEnabled() {
  return process.env.ROOMMATES_ENABLED === "true";
}

export const ROOMMATE_DORMS = [
  { value: "peniel", label: "브니엘관", roomSizes: [2] },
  { value: "salem", label: "살렘관", roomSizes: [2] },
  { value: "sion", label: "시온관", roomSizes: [2, 3] },
  { value: "eden", label: "에덴관", roomSizes: [2, 3, 4] },
] as const;

export const ROOMMATE_HABIT_OPTIONS = {
  bedtime: ["before22", "22to24", "0to2", "after2", "flexible"],
  wakeTime: ["before6", "6to8", "8to10", "after10", "flexible"],
  cleaning: ["often", "regular", "discuss"],
  calls: ["outside", "short", "discuss"],
  sleepHabits: ["none", "snoring", "grinding", "talking", "unknown"],
  smoking: ["nonsmoker", "smoker"],
  temperature: ["heat", "cold", "discuss"],
  sharing: ["never", "permission", "discuss"],
} as const;
export const ROOMMATE_REPORT_REASONS = ["spam", "false_info", "inappropriate", "privacy", "other"] as const;
export const ROOMMATE_INPUT_FIELDS = ["nickname", "dorm", "roomSize", "stayStart", "stayEnd", "roommatesNeeded", "recruitUntil", "habits", "description", "openChatUrl"] as const;

export class RoommateError extends Error {
  constructor(public status: number, public code: string, message: string, public field?: string) {
    super(message);
    this.name = "RoommateError";
  }
}

function invalid(field: string, message: string): never {
  throw new RoommateError(400, "INVALID_INPUT", message, field);
}

export function roommateObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) invalid("body", "입력 내용을 확인해주세요.");
  return input as Record<string, unknown>;
}

export function assertRoommateFields(input: Record<string, unknown>, fields: readonly string[]) {
  const unknown = Object.keys(input).find((field) => !fields.includes(field));
  if (unknown) invalid(unknown, "허용되지 않은 입력 항목입니다.");
}

function text(value: unknown, field: string, min: number, max: number, optional = false): string {
  if (optional && value === undefined) return "";
  if (typeof value !== "string") invalid(field, "문자열을 입력해주세요.");
  const result = value.trim();
  if (Array.from(result).length < min || Array.from(result).length > max) invalid(field, `${min}자부터 ${max}자까지 입력해주세요.`);
  return result;
}

function roommateDate(value: unknown, field = "date"): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid(field, "날짜를 확인해주세요.");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value < "1900-01-01") invalid(field, "실제 달력 날짜를 입력해주세요.");
  return value;
}

export function koreaDate(now = Date.now()): string {
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function defaultRecruitDeadline(stayEnd: string, now = Date.now()): string {
  const latest = koreaDate(now + 29 * DAY_MS);
  return stayEnd < latest ? stayEnd : latest;
}

export function recruitDeadlineMillis(date: string): number {
  return new Date(`${roommateDate(date)}T00:00:00.000+09:00`).getTime() + DAY_MS;
}

export function normalizeRoommateHabits(value: unknown): RoommateHabits {
  const input = value === undefined ? {} : roommateObject(value);
  assertRoommateFields(input, Object.keys(ROOMMATE_HABIT_OPTIONS));
  const result: Record<string, string | string[]> = {};
  for (const [field, choices] of Object.entries(ROOMMATE_HABIT_OPTIONS)) {
    const selected = input[field];
    if (selected === undefined) continue;
    if (field === "sleepHabits" || field === "temperature") {
      if (!Array.isArray(selected) || selected.length > choices.length || selected.some((item) => typeof item !== "string" || !(choices as readonly string[]).includes(item))) invalid(`habits.${field}`, "생활습관 선택을 확인해주세요.");
      const values = [...new Set(selected)] as string[];
      if (field === "sleepHabits" && values.length > 1 && values.some((item) => item === "none" || item === "unknown")) invalid(`habits.${field}`, "없음과 잘 모름은 다른 잠버릇과 함께 선택할 수 없습니다.");
      if (values.length) result[field] = values;
    } else {
      if (typeof selected !== "string" || !(choices as readonly string[]).includes(selected)) invalid(`habits.${field}`, "생활습관 선택을 확인해주세요.");
      result[field] = selected;
    }
  }
  return result as RoommateHabits;
}

export function normalizeRoommatePostInput(value: unknown, options: { now?: number; createdAt?: number; previousDeadline?: string } = {}): RoommatePostInput {
  const input = roommateObject(value);
  assertRoommateFields(input, ROOMMATE_INPUT_FIELDS);
  const now = options.now ?? Date.now();
  const dorm = ROOMMATE_DORMS.find((option) => option.value === input.dorm);
  if (!dorm) invalid("dorm", "기숙사를 선택해주세요.");
  if (typeof input.roomSize !== "number" || !(dorm.roomSizes as readonly number[]).includes(input.roomSize)) invalid("roomSize", "기숙사에서 제공하는 인실을 선택해주세요.");
  if (!Number.isInteger(input.roommatesNeeded) || Number(input.roommatesNeeded) < 1 || Number(input.roommatesNeeded) >= input.roomSize) invalid("roommatesNeeded", "인실 정원에 맞는 모집 인원을 선택해주세요.");
  const stayStart = roommateDate(input.stayStart, "stayStart");
  const stayEnd = roommateDate(input.stayEnd, "stayEnd");
  if (stayStart > stayEnd || stayEnd < koreaDate(now)) invalid("stayEnd", "거주 종료일은 시작일과 오늘보다 빠를 수 없습니다.");
  const recruitUntil = roommateDate(input.recruitUntil, "recruitUntil");
  const maxDeadline = defaultRecruitDeadline(stayEnd, options.createdAt ?? now);
  if (recruitUntil < koreaDate(now) || recruitUntil > maxDeadline || (options.previousDeadline && recruitUntil > options.previousDeadline)) invalid("recruitUntil", "모집 마감일은 등록일 포함 30일과 거주 종료일 안에서 정하며 수정 시 연장할 수 없습니다.");
  const openChatUrl = text(input.openChatUrl, "openChatUrl", 1, 200);
  if (!/^https:\/\/open\.kakao\.com\/o\/[A-Za-z0-9]+$/.test(openChatUrl)) invalid("openChatUrl", "https://open.kakao.com/o/로 시작하는 오픈채팅 링크를 입력해주세요.");
  return {
    nickname: text(input.nickname, "nickname", 2, 12), dorm: dorm.value,
    roomSize: input.roomSize, stayStart, stayEnd, roommatesNeeded: Number(input.roommatesNeeded), recruitUntil,
    habits: normalizeRoommateHabits(input.habits), description: text(input.description, "description", 0, 300, true), openChatUrl,
  };
}

export function normalizeRoommateReportInput(value: unknown): RoommateReportInput {
  const input = roommateObject(value);
  assertRoommateFields(input, ["reason", "description"]);
  if (!(ROOMMATE_REPORT_REASONS as readonly unknown[]).includes(input.reason)) invalid("reason", "신고 사유를 선택해주세요.");
  return { reason: input.reason as RoommateReportInput["reason"], description: text(input.description, "description", 0, 300, true) };
}

export function expectedRoommateVersion(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) invalid("expectedVersion", "최신 글 버전을 확인해주세요.");
  return value;
}

export function parseRoommateFilters(params: URLSearchParams): RoommatePostFilters {
  const allowed = ["dorm", "roomSize", "stayStart", "stayEnd", "cursor", ...Object.keys(ROOMMATE_HABIT_OPTIONS)];
  for (const field of params.keys()) if (!allowed.includes(field)) invalid(field, "허용되지 않은 검색 조건입니다.");
  const filters: RoommatePostFilters = {};
  if (params.has("dorm")) {
    const dorm = ROOMMATE_DORMS.find((option) => option.value === params.get("dorm"));
    if (!dorm) invalid("dorm", "기숙사 검색 조건을 확인해주세요.");
    filters.dorm = dorm.value;
  }
  if (params.has("roomSize")) {
    const size = Number(params.get("roomSize"));
    if (![2, 3, 4].includes(size)) invalid("roomSize", "인실 검색 조건을 확인해주세요.");
    filters.roomSize = size;
  }
  if (params.has("stayStart")) filters.stayStart = roommateDate(params.get("stayStart"), "stayStart");
  if (params.has("stayEnd")) filters.stayEnd = roommateDate(params.get("stayEnd"), "stayEnd");
  if (filters.stayStart && filters.stayEnd && filters.stayStart > filters.stayEnd) invalid("stayEnd", "검색 종료일을 확인해주세요.");
  const habits: Record<string, unknown> = {};
  for (const field of Object.keys(ROOMMATE_HABIT_OPTIONS)) {
    const value = params.get(field);
    if (value !== null) habits[field] = field === "sleepHabits" || field === "temperature" ? value.split(",") : value;
  }
  filters.habits = normalizeRoommateHabits(habits);
  return filters;
}

export function matchesRoommateFilters(post: RoommatePostInput, filters: RoommatePostFilters): boolean {
  if (filters.dorm && post.dorm !== filters.dorm) return false;
  if (filters.roomSize && post.roomSize !== filters.roomSize) return false;
  if (filters.stayStart && post.stayEnd < filters.stayStart) return false;
  if (filters.stayEnd && post.stayStart > filters.stayEnd) return false;
  return Object.entries(filters.habits ?? {}).every(([field, value]) => {
    const actual = post.habits[field as keyof RoommateHabits];
    return Array.isArray(value) ? Array.isArray(actual) && value.every((item) => actual.includes(item as never)) : actual === value;
  });
}
