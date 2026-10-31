import type {
  AcademicSchedule,
  Announcement,
  HomeNoticeCategory,
  PhoneNumber,
  ServiceNotice,
} from "@/types";
import {
  DEFAULT_LOCALE,
  localizePath,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n/routing";
import type { Dictionary } from "@/lib/i18n";
import { getKoreaDateTimeParts } from "@/lib/korea-time";

export type TodayInfo = {
  dateStringDot: string;
  dateStringDash: string;
  isWeekend: boolean;
  dayOfWeek: number;
};

export type HomeSearchResult =
  | Announcement
  | AcademicSchedule
  | PhoneNumber;

export type HomeNotice =
  | {
      type: "announcement";
      data: Announcement;
    }
  | {
      type: "service";
      data: ServiceNotice;
    };

export type SearchCategoryItem = Announcement | AcademicSchedule | PhoneNumber;

export type CategorizedSearchResults = Record<
  string,
  {
    label: string;
    items: SearchCategoryItem[];
    linkPath: string;
  }
>;

export function getKoreaNow(): Date {
  return new Date();
}

export function getSemesterEndCountdown(schedules: AcademicSchedule[], today: string) {
  const month = Number(today.slice(5, 7));
  if (!today || month < 3 || (month > 6 && month < 9)) return null;
  const year = today.slice(0, 4);
  const termStart = `${year}.${month < 9 ? "03" : "09"}.01`;
  const termEnd = `${year}.${month < 9 ? "06.30" : "12.31"}`;
  const date = today.replaceAll("-", ".");
  const opening = schedules.find(item => item.title.startsWith("개강") &&
    item.startDate >= termStart && item.startDate <= termEnd);
  if (!opening || date < opening.startDate) return null;
  const exam = schedules.filter(item => item.category === "exam" && item.title.startsWith("기말고사") &&
    item.startDate >= termStart && item.endDate <= termEnd && item.endDate >= date)
    .sort((a, b) => a.endDate.localeCompare(b.endDate))[0];
  if (!exam) return null;
  const endDate = exam.endDate.replaceAll(".", "-");
  const days = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000 + 1;
  return Number.isFinite(days) ? { days } : null;
}

export function isFestivalPromotionVisible(date: string): boolean {
  return date >= "2026-09-28" && date <= "2026-10-06";
}

export function getTodayInfo(now: Date | null): TodayInfo {
  if (!now) {
    return {
      dateStringDot: "",
      dateStringDash: "",
      isWeekend: false,
      dayOfWeek: -1,
    };
  }

  const { dayOfWeek, year, month, date } = getKoreaDateTimeParts(now);
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const monthText = String(month).padStart(2, "0");
  const dateText = String(date).padStart(2, "0");

  return {
    dateStringDot: `${year}.${monthText}.${dateText}`,
    dateStringDash: `${year}-${monthText}-${dateText}`,
    isWeekend,
    dayOfWeek,
  };
}

function createEmptySearchCategories(
  categories: Dictionary["categories"],
  locale: Locale,
): CategorizedSearchResults {
  return {
    academicSchedule: {
      label: categories.academicSchedule,
      items: [],
      linkPath: localizePath("/academic/schedule", locale),
    },
    academicAnnouncement: {
      label: categories.academicAnnouncement,
      items: [],
      linkPath: localizePath("/academic/announcements", locale),
    },
    campusAnnouncement: {
      label: categories.campusAnnouncement,
      items: [],
      linkPath: localizePath("/campus/announcements", locale),
    },
    swAnnouncement: {
      label: categories.swAnnouncement,
      items: [],
      linkPath: localizePath("/academic/sw-notices", locale),
    },
    scholarship: {
      label: categories.scholarship,
      items: [],
      linkPath: localizePath("/academic/scholarship", locale),
    },
    phoneNumbers: {
      label: categories.phoneNumbers,
      items: [],
      linkPath: localizePath("/campus/phone", locale),
    },
  };
}

export function categorizeSearchResults(
  searchResults: HomeSearchResult[] | undefined,
  categoryLabels: Dictionary["categories"],
  locale: Locale = DEFAULT_LOCALE,
): CategorizedSearchResults {
  const categories = createEmptySearchCategories(categoryLabels, normalizeLocale(locale));

  if (!searchResults) {
    return categories;
  }

  searchResults.forEach((result) => {
    if ("phone" in result && "department" in result) {
      categories.phoneNumbers.items.push(result);
      return;
    }

    if ("startDate" in result) {
      categories.academicSchedule.items.push(result);
      return;
    }

    if ("category" in result) {
      if (result.category === "academic") {
        categories.academicAnnouncement.items.push(result);
      } else if (result.category === "campus") {
        categories.campusAnnouncement.items.push(result);
      } else if (result.category === "scholarship") {
        categories.scholarship.items.push(result);
      } else if (result.category === "sw") {
        categories.swAnnouncement.items.push(result);
      }
    }
  });

  return categories;
}

export function isScheduleOnDate(
  schedule: AcademicSchedule,
  dateStringDot: string,
): boolean {
  return (
    schedule.startDate === dateStringDot ||
    (dateStringDot >= schedule.startDate && dateStringDot <= schedule.endDate)
  );
}

export function getHomeNotices(
  announcements?: Announcement[],
  serviceNotices?: ServiceNotice[],
  selectedCategory?: HomeNoticeCategory,
  limit = 3,
): HomeNotice[] {
  const combined: HomeNotice[] = [
    ...(announcements ?? []).map((data) => ({
      type: "announcement" as const,
      data,
    })),
  ];

  if (selectedCategory === undefined) {
    combined.push(
      ...(serviceNotices ?? []).map((data) => ({
        type: "service" as const,
        data,
      })),
    );
  }

  return combined
    .sort((a, b) => getNoticeTime(b) - getNoticeTime(a))
    .slice(0, limit);
}

function getNoticeTime(notice: HomeNotice): number {
  const normalizedDate = notice.data.date.replace(/\./g, "-");
  const parsed = new Date(normalizedDate).getTime();

  return Number.isNaN(parsed) ? 0 : parsed;
}
