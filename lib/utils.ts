import type { AcademicSchedule, AnnouncementCategory } from "@/types";
import {
  DEFAULT_LOCALE,
  getDictionary,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n";

type CategoryLabel = AnnouncementCategory | AcademicSchedule["category"];

function parseDateString(dateString: string): Date | null {
  if (!dateString || typeof dateString !== "string") {
    return null;
  }

  const trimmed = dateString.trim();

  const dottedMatch = trimmed.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (dottedMatch) {
    const year = Number(dottedMatch[1]);
    const month = Number(dottedMatch[2]);
    const day = Number(dottedMatch[3]);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }

    return null;
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }

    return null;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Format a date as MM.DD.
 */
export function formatDate(dateString: string): string {
  const date = parseDateString(dateString);
  if (!date) return dateString;

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}.${day}`;
}

/**
 * Format a date as YYYY.MM.DD.
 */
export function formatDateWithYear(dateString: string): string {
  const date = parseDateString(dateString);
  if (!date) return dateString;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

/**
 * Format a date in the Korean long-date style.
 */
function formatDateKorean(dateString: string): string {
  const date = parseDateString(dateString);
  if (!date) return dateString;

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}년 ${month}월 ${day}일`;
}

function formatDateLocalized(dateString: string, locale: Locale): string {
  if (normalizeLocale(locale) === "ko") {
    return formatDateKorean(dateString);
  }

  const date = parseDateString(dateString);
  if (!date) return dateString;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatShortDateLocalized(dateString: string, locale: Locale): string {
  if (normalizeLocale(locale) === "ko") {
    return formatDate(dateString);
  }

  const date = parseDateString(dateString);
  if (!date) return dateString;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Return a localized category label.
 */
export function getCategoryLabel(
  category: CategoryLabel,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const dictionary = getDictionary(normalizeLocale(locale));
  return dictionary.categories[category];
}

/**
 * Return a category color token.
 */
export function getCategoryColor(
  category: AnnouncementCategory,
): "blue" | "red" | "green" | "yellow" | "purple" {
  const colors: Record<
    AnnouncementCategory,
    "blue" | "red" | "green" | "yellow" | "purple"
  > = {
    academic: "blue",
    scholarship: "yellow",
    campus: "green",
  };
  return colors[category];
}

/**
 * Format a date range for display.
 */
export function formatDateRange(
  start: string,
  end: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const normalizedLocale = normalizeLocale(locale);
  if (start === end) return formatDateLocalized(start, normalizedLocale);
  const separator = normalizedLocale === "ko" ? " ~ " : " - ";
  return `${formatShortDateLocalized(start, normalizedLocale)}${separator}${formatShortDateLocalized(end, normalizedLocale)}`;
}
