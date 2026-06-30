import type {
  AcademicSchedule,
  Announcement,
  PhoneNumber,
} from "@/types";
import type { ReactNode } from "react";

export type SearchableResult =
  | Announcement
  | AcademicSchedule
  | PhoneNumber;

export function highlightText(text: string, query: string): ReactNode {
  const normalized = query.trim();
  if (!normalized) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = normalized.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index < 0) return text;

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-yellow-100 px-0.5 text-neutral-950">
        {text.slice(index, index + normalized.length)}
      </mark>
      {text.slice(index + normalized.length)}
    </>
  );
}

export function getSearchSnippet(
  text: string | undefined,
  query: string,
  maxLength = 120,
): string {
  if (!text) return "";

  const normalized = query.trim().toLowerCase();
  if (!normalized || text.length <= maxLength) return text;

  const index = text.toLowerCase().indexOf(normalized);
  if (index < 0) return `${text.slice(0, maxLength)}...`;

  const start = Math.max(0, index - 35);
  const end = Math.min(text.length, start + maxLength);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

export function sortSearchResults(
  results: SearchableResult[],
  rawQuery: string,
): SearchableResult[] {
  const query = rawQuery.trim().toLowerCase();

  return [...results].sort((a, b) => {
    const exactDiff = getExactScore(b, query) - getExactScore(a, query);
    if (exactDiff !== 0) return exactDiff;

    const priorityDiff = getTypePriority(a) - getTypePriority(b);
    if (priorityDiff !== 0) return priorityDiff;

    if (isAnnouncement(a) && isAnnouncement(b)) {
      const pinDiff = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
      if (pinDiff !== 0) return pinDiff;
      const importantDiff =
        Number(Boolean(b.isImportant)) - Number(Boolean(a.isImportant));
      if (importantDiff !== 0) return importantDiff;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }

    if (isSchedule(a) && isSchedule(b)) {
      return getScheduleDistance(a) - getScheduleDistance(b);
    }

    if (isPhone(a) && isPhone(b)) {
      return a.department.localeCompare(b.department, "ko");
    }

    return 0;
  });
}

function getExactScore(item: SearchableResult, query: string): number {
  if (!query) return 0;

  if (isPhone(item)) {
    if (item.department.toLowerCase() === query || item.phone === query) return 4;
    if (item.department.toLowerCase().startsWith(query)) return 3;
    return 0;
  }

  if ("title" in item && item.title.toLowerCase() === query) return 4;
  if ("title" in item && item.title.toLowerCase().startsWith(query)) return 3;
  return 0;
}

function getTypePriority(item: SearchableResult): number {
  if (isSchedule(item)) return 1;
  if (isAnnouncement(item)) return 2;
  if (isPhone(item)) return 3;
  return 4;
}

function getScheduleDistance(schedule: AcademicSchedule): number {
  const normalized = schedule.startDate.replace(/\./g, "-");
  const time = new Date(normalized).getTime();
  if (!Number.isFinite(time)) return Number.MAX_SAFE_INTEGER;

  const diff = time - Date.now();
  return diff >= 0 ? diff : Math.abs(diff) + 1000 * 60 * 60 * 24 * 365;
}

function isAnnouncement(item: SearchableResult): item is Announcement {
  return "views" in item && "isImportant" in item;
}

function isSchedule(item: SearchableResult): item is AcademicSchedule {
  return "startDate" in item;
}

function isPhone(item: SearchableResult): item is PhoneNumber {
  return "phone" in item && "department" in item;
}
