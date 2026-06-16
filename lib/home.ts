import type {
  AcademicSchedule,
  Announcement,
  HomeNoticeCategory,
  PhoneNumber,
  Scholarship,
  ServiceNotice,
} from "@/types";
import {
  DEFAULT_LOCALE,
  getDictionary,
  localizePath,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n";

export type TodayInfo = {
  dateStringDot: string;
  dateStringDash: string;
  isWeekend: boolean;
  dayOfWeek: number;
};

export type HomeSearchResult =
  | Announcement
  | AcademicSchedule
  | Scholarship
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
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
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

  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");

  return {
    dateStringDot: `${year}.${month}.${date}`,
    dateStringDash: `${year}-${month}-${date}`,
    isWeekend,
    dayOfWeek,
  };
}

function createEmptySearchCategories(
  locale: Locale = DEFAULT_LOCALE,
): CategorizedSearchResults {
  const dictionary = getDictionary(locale);

  return {
    academicSchedule: {
      label: dictionary.categories.academicSchedule,
      items: [],
      linkPath: localizePath("/academic/schedule", locale),
    },
    academicAnnouncement: {
      label: dictionary.categories.academicAnnouncement,
      items: [],
      linkPath: localizePath("/academic/announcements", locale),
    },
    campusAnnouncement: {
      label: dictionary.categories.campusAnnouncement,
      items: [],
      linkPath: localizePath("/campus/announcements", locale),
    },
    scholarship: {
      label: dictionary.categories.scholarship,
      items: [],
      linkPath: localizePath("/academic/scholarship", locale),
    },
    phoneNumbers: {
      label: dictionary.categories.phoneNumbers,
      items: [],
      linkPath: localizePath("/campus/phone", locale),
    },
  };
}

export function categorizeSearchResults(
  searchResults?: HomeSearchResult[],
  locale: Locale = DEFAULT_LOCALE,
): CategorizedSearchResults {
  const categories = createEmptySearchCategories(normalizeLocale(locale));

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
