import type { AcademicSchedule } from "../types/academic";
import type { PublicHolidaySnapshot } from "../types/public-holidays";

export const PUBLIC_HOLIDAY_SOURCE_URL =
  "https://www.data.go.kr/data/15012690/openapi.do";
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export function emptyPublicHolidays(): PublicHolidaySnapshot {
  return { schemaVersion: 1, sourceUrl: PUBLIC_HOLIDAY_SOURCE_URL, lastSuccessAt: null, years: [], holidays: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function parsePublicHolidaySnapshot(value: unknown): PublicHolidaySnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.sourceUrl !== PUBLIC_HOLIDAY_SOURCE_URL ||
    !Array.isArray(value.years) || value.years.length > 10 ||
    value.years.some((year) => !Number.isInteger(year) || year < 2000 || year > 2200) ||
    new Set(value.years).size !== value.years.length || !Array.isArray(value.holidays) ||
    value.holidays.length > 1000 ||
    (value.stale !== undefined && typeof value.stale !== "boolean")) {
    throw new Error("Invalid public holiday snapshot");
  }
  if (value.lastSuccessAt === null) {
    if (value.years.length || value.holidays.length) throw new Error("Uncollected holiday data must have no coverage");
  } else if (typeof value.lastSuccessAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value.lastSuccessAt) ||
    !isDate(value.lastSuccessAt.slice(0, 10)) || !Number.isFinite(Date.parse(value.lastSuccessAt)) ||
    !value.years.length) {
    throw new Error("Invalid holiday collection time or coverage");
  }
  const years = value.years as number[];
  const dates = new Set<string>();
  const holidays = value.holidays.map((item) => {
    if (!isRecord(item) || !isDate(item.date) || !years.includes(Number(item.date.slice(0, 4))) ||
      dates.has(item.date) || !Array.isArray(item.names) || !item.names.length || item.names.length > 10 ||
      item.names.some((name) => typeof name !== "string" || !name.trim() || name.length > 100) ||
      new Set(item.names).size !== item.names.length) {
      throw new Error("Invalid or duplicate public holiday");
    }
    dates.add(item.date);
    return { date: item.date, names: item.names as string[] };
  });
  return {
    schemaVersion: 1,
    sourceUrl: PUBLIC_HOLIDAY_SOURCE_URL,
    lastSuccessAt: value.lastSuccessAt as string | null,
    years, holidays,
    ...(value.stale !== undefined ? { stale: value.stale as boolean } : {}),
  };
}

export function getPublicHoliday(date: string, snapshot?: PublicHolidaySnapshot, now = new Date()) {
  const dateKey = date.replaceAll(".", "-");
  const collectedAt = snapshot?.lastSuccessAt ? Date.parse(snapshot.lastSuccessAt) : NaN;
  const isStale = snapshot?.stale === true || !Number.isFinite(collectedAt) ||
    now.getTime() - collectedAt > MAX_AGE_MS || collectedAt > now.getTime() + 5 * 60 * 1000;
  const covered = isDate(dateKey) && snapshot?.years.includes(Number(dateKey.slice(0, 4)));
  const holiday = covered ? snapshot?.holidays.find((item) => item.date === dateKey) : undefined;
  return {
    status: holiday ? "holiday" as const : covered && !isStale ? "not-holiday" as const : "unknown" as const,
    names: holiday?.names ?? [], isStale,
    lastSuccessAt: snapshot?.lastSuccessAt ?? null,
  };
}

function matchesHoliday(title: string, names: string[]) {
  const normalized = title.replace(/\s/g, "");
  return names.some((name) => {
    const official = name.replace(/\s/g, "");
    return normalized === official ||
      (normalized === "대체휴일" && official.startsWith("대체공휴일")) ||
      (normalized === "성탄절" && official === "기독탄신일") ||
      (normalized === "신정" && official === "1월1일") ||
      (normalized === "근로자의날" && official === "노동절") ||
      (normalized === "지방선거" && official === "전국동시지방선거");
  });
}

export function mergePublicHolidays(schedules: AcademicSchedule[], snapshot?: PublicHolidaySnapshot): AcademicSchedule[] {
  const holidays = snapshot?.holidays ?? [];
  const originals = schedules.filter((schedule) => !holidays.some((holiday) =>
    schedule.category !== "exam" && schedule.startDate === schedule.endDate &&
    schedule.startDate.replaceAll(".", "-") === holiday.date && matchesHoliday(schedule.title, holiday.names),
  ));
  return [...originals, ...holidays.map((holiday): AcademicSchedule => ({
    id: `public-holiday-${holiday.date}`, title: holiday.names.join(" · "),
    startDate: holiday.date.replaceAll("-", "."), endDate: holiday.date.replaceAll("-", "."),
    category: "holiday",
  }))].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));
}
