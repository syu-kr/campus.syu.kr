"use client";
import { PublicContentTranslation } from "@/app/components/ContentTranslation";

import Link from "next/link";
import { Badge } from "@/app/components/Badge";
import { Icon } from "@/app/components/Icon";
import {
  HomeNoticeCard,
  ServiceNoticeCard,
} from "@/app/components/HomeNoticeCard";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { formatDate, getCategoryLabel } from "@/lib/utils";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { localizePath, type Dictionary } from "@/lib/i18n";
import type {
  AcademicSchedule,
  HomeNoticeCategory,
  ServiceNotice,
} from "@/types";
import type { HomeNotice } from "@/lib/home";
import { formatPublicHolidayName } from "@/lib/public-holidays";

function getCategoryFilters(dictionary: Dictionary): Array<{
  id: string;
  label: string;
  value: HomeNoticeCategory | undefined;
}> {
  return [
    { id: "all", label: dictionary.home.notices.all, value: undefined },
    {
      id: "academic",
      label: dictionary.home.notices.academic,
      value: "academic",
    },
    {
      id: "scholarship",
      label: dictionary.home.notices.scholarship,
      value: "scholarship",
    },
    { id: "campus", label: dictionary.home.notices.campus, value: "campus" },
    { id: "sw", label: dictionary.home.notices.sw, value: "sw" },
    { id: "uisp", label: dictionary.home.notices.uisp, value: "uisp" },
    { id: "service", label: dictionary.home.notices.service, value: "service" },
  ];
}

export function HomeNoticesSection({
  selectedCategory,
  onCategoryChange,
  serviceNotices,
  serviceNoticesLoading,
  announcementsLoading,
  hasError,
  onRetry,
  homeNotices,
}: {
  selectedCategory?: HomeNoticeCategory;
  onCategoryChange: (category?: HomeNoticeCategory) => void;
  serviceNotices?: ServiceNotice[];
  serviceNoticesLoading: boolean;
  announcementsLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
  homeNotices: HomeNotice[];
}) {
  const locale = useLocale();
  const dictionary = useDictionary();
  const categoryFilters = getCategoryFilters(dictionary);

  return (
    <div className="border-b border-neutral-200 pb-4 sm:pb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">
          {dictionary.home.notices.title}
        </h2>
        <Link
          href={localizePath(getNoticeListPath(selectedCategory), locale)}
          className="text-xs text-primary-600 hover:text-primary-700"
        >
          {getNoticeListLabel(selectedCategory, dictionary)} →
        </Link>
      </div>

      <div
        role="group"
        aria-label={dictionary.home.notices.title}
        className="mb-4 flex flex-wrap gap-2"
      >
        {categoryFilters.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onCategoryChange(cat.value)}
            aria-pressed={selectedCategory === cat.value}
            className={`min-h-11 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
              selectedCategory === cat.value
                ? "bg-primary-600 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {hasError && <DashboardLoadError onRetry={onRetry} />}
        {selectedCategory === "service" ? (
          <>
            {serviceNoticesLoading && <Skeleton count={3} />}
            {!serviceNoticesLoading &&
            serviceNotices &&
            serviceNotices.length > 0 ? (
              serviceNotices.slice(0, 3).map((notice) => (
                <div key={notice.slug} className="mb-2">
                  <ServiceNoticeCard notice={notice} />
                </div>
              ))
            ) : !hasError ? (
              <StateCard
                type="info"
                message={dictionary.home.notices.emptyService}
              />
            ) : null}
          </>
        ) : (
          <>
            {(announcementsLoading || serviceNoticesLoading) && (
              <Skeleton count={3} />
            )}
            {!announcementsLoading && !serviceNoticesLoading && (
              <>
                {homeNotices.length === 0 && !hasError ? (
                  <StateCard
                    type="info"
                    message={dictionary.home.notices.emptyCategory}
                  />
                ) : (
                  homeNotices.map((notice) => (
                    <HomeNoticeCard
                      key={`${notice.type}-${
                        notice.type === "service"
                          ? notice.data.slug
                          : notice.data.id
                      }`}
                      notice={notice}
                    />
                  ))
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function TodaySchedulesSection({
  isLoading,
  isError,
  onRetry,
  schedules,
}: {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  schedules: AcademicSchedule[];
}) {
  const dictionary = useDictionary();
  const locale = useLocale();

  return (
    <div>
      <SectionTitle
        title={dictionary.home.dashboard.todaySchedules}
        href="/academic/schedule"
      />
      <div className="m3-home-schedule-list">
        {isLoading && <Skeleton count={2} />}
        {isError && <DashboardLoadError onRetry={onRetry} />}
        {!isLoading &&
          (schedules.length === 0 && !isError ? (
            <p className="m3-home-empty">{dictionary.home.dashboard.scheduleEmpty}</p>
          ) : schedules.length > 0 ? (
            schedules.map((schedule) => (
              <Link key={schedule.id} href={localizePath("/academic/schedule", locale)} className="m3-home-schedule-row">
                <div className="m3-home-schedule-copy">
                  <Badge
                    color={schedule.category === "exam" || schedule.id.startsWith("public-holiday-") ? "red" : "blue"}
                    size="sm"
                  >
                    {schedule.id.startsWith("public-holiday-") ? dictionary.publicHolidays.label : getCategoryLabel(schedule.category, dictionary.categories)}
                  </Badge>
                  <PublicContentTranslation source={{ kind: "schedule", id: schedule.id }} content={schedule.id.startsWith("public-holiday-") ? {} : { title: schedule.title }}>{translation => <h3 lang={schedule.id.startsWith("public-holiday-") ? locale : translation.lang} className="m3-home-schedule-title">{translation.text("title", schedule.id.startsWith("public-holiday-") ? schedule.title.split(" · ").map(name => formatPublicHolidayName(name, locale)).join(" · ") : schedule.title)}</h3>}</PublicContentTranslation>
                  <p className="m3-home-schedule-date">
                    {formatDate(schedule.startDate)} ~{" "}
                    {formatDate(schedule.endDate)}
                  </p>
                </div>
                <Icon name="chevron-right" size={18} />
              </Link>
            ))
          ) : null)}
      </div>
    </div>
  );
}

function SectionTitle({ title, href }: { title: string; href?: string }) {
  const locale = useLocale();
  const dictionary = useDictionary();

  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-neutral-900"><Icon name="calendar" />{title}</h2>
      {href && (
        <Link
          href={localizePath(href, locale)}
          className="text-xs text-primary-600 hover:text-primary-700"
        >
          {dictionary.search.viewAll} →
        </Link>
      )}
    </div>
  );
}

function DashboardLoadError({ onRetry }: { onRetry: () => void }) {
  const dictionary = useDictionary();

  return (
    <StateCard
      type="warning"
      title={dictionary.home.dashboard.loadFailedTitle}
      message={dictionary.home.dashboard.loadFailedMessage}
      action={
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          {dictionary.home.dashboard.retry}
        </button>
      }
    />
  );
}

function getNoticeListPath(selectedCategory?: HomeNoticeCategory) {
  if (selectedCategory === "scholarship") return "/academic/scholarship";
  if (selectedCategory === "campus") return "/campus/announcements";
  if (selectedCategory === "sw") return "/academic/sw-notices";
  if (selectedCategory === "uisp") return "/academic/uisp-notices";
  if (selectedCategory === "service") return "/service/notices";
  if (selectedCategory === "academic") return "/academic/announcements";
  return "/announcements";
}

function getNoticeListLabel(
  selectedCategory: HomeNoticeCategory | undefined,
  dictionary: Dictionary,
) {
  if (selectedCategory === "scholarship") {
    return dictionary.home.notices.scholarshipAll;
  }
  if (selectedCategory === "campus") return dictionary.home.notices.campusAll;
  if (selectedCategory === "sw") return dictionary.home.notices.swAll;
  if (selectedCategory === "uisp") return dictionary.home.notices.uispAll;
  if (selectedCategory === "service") return dictionary.home.notices.serviceAll;
  if (selectedCategory === "academic") {
    return dictionary.home.notices.academicAll;
  }
  return dictionary.home.notices.allNotices;
}
