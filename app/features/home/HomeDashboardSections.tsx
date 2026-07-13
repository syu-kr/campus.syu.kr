"use client";

import Link from "next/link";
import { Badge } from "@/app/components/Badge";
import { Card } from "@/app/components/Card";
import {
  HomeNoticeCard,
  ServiceNoticeCard,
} from "@/app/components/HomeNoticeCard";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { CafeteriaClosedCard } from "@/app/features/cafeteria/CafeteriaMenuCards";
import { isCafeteriaClosedDay, isClosedMealItems } from "@/lib/cafeteria";
import { getCurrentShuttleSummary } from "@/lib/shuttle-schedule";
import { formatDate, getCategoryLabel } from "@/lib/utils";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { localizePath, type Dictionary } from "@/lib/i18n";
import type {
  AcademicSchedule,
  CafeteriaMenu,
  HomeNoticeCategory,
  ServiceNotice,
  ShuttleBusSchedule,
  ShuttleSpecialPeriods,
} from "@/types";
import type { HomeNotice, TodayInfo } from "@/lib/home";

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
    { id: "service", label: dictionary.home.notices.service, value: "service" },
  ];
}

export function HomeNoticesSection({
  selectedCategory,
  onCategoryChange,
  serviceNotices,
  serviceNoticesLoading,
  announcementsLoading,
  homeNotices,
}: {
  selectedCategory?: HomeNoticeCategory;
  onCategoryChange: (category?: HomeNoticeCategory) => void;
  serviceNotices?: ServiceNotice[];
  serviceNoticesLoading: boolean;
  announcementsLoading: boolean;
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

      <div className="scrollbar-hide mb-4 flex gap-2 overflow-x-auto">
        {categoryFilters.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onCategoryChange(cat.value)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
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
            ) : (
              <StateCard
                type="info"
                message={dictionary.home.notices.emptyService}
              />
            )}
          </>
        ) : (
          <>
            {(announcementsLoading || serviceNoticesLoading) && (
              <Skeleton count={3} />
            )}
            {!announcementsLoading && !serviceNoticesLoading && (
              <>
                {homeNotices.length === 0 ? (
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

export function TodayMenuSection({
  isLoading,
  todayInfo,
  todayMenu,
  hasStaleMenuData = false,
}: {
  isLoading: boolean;
  todayInfo: TodayInfo;
  todayMenu: CafeteriaMenu | null;
  hasStaleMenuData?: boolean;
}) {
  const dictionary = useDictionary();
  const showStaleMenu = hasStaleMenuData && !todayInfo.isWeekend;

  return (
    <div>
      <SectionTitle title={dictionary.home.dashboard.cafeteria} />
      <div className="space-y-3">
        {isLoading && <Skeleton count={2} />}
        {!isLoading && todayInfo.isWeekend && (
          <StateCard
            type="info"
            message={dictionary.home.dashboard.weekendMenu}
            action={<ViewFullMenuLink />}
          />
        )}
        {!isLoading && showStaleMenu && (
          <StateCard
            type="warning"
            title={dictionary.home.dashboard.staleMenuTitle}
            message={dictionary.home.dashboard.staleMenuMessage}
            action={<ViewFullMenuLink />}
          />
        )}
        {!isLoading &&
          !showStaleMenu &&
          !todayInfo.isWeekend &&
          todayMenu &&
          isCafeteriaClosedDay(todayMenu) && (
            <CafeteriaClosedCard
              compact
              title={dictionary.home.dashboard.closedMenuTitle}
              message={dictionary.home.dashboard.closedMenuMessage}
              action={<ViewFullMenuLink />}
            />
          )}
        {!isLoading &&
          !showStaleMenu &&
          !todayInfo.isWeekend &&
          todayMenu &&
          !isCafeteriaClosedDay(todayMenu) && (
            <TodayMenuCard todayMenu={todayMenu} />
          )}
        {!isLoading &&
          !showStaleMenu &&
          !todayInfo.isWeekend &&
          todayInfo.dayOfWeek === 1 &&
          !todayMenu && <PendingMenuCard />}
        {!isLoading &&
          !showStaleMenu &&
          !todayInfo.isWeekend &&
          todayInfo.dayOfWeek !== 1 &&
          !todayMenu && (
            <StateCard
              type="warning"
              message={dictionary.home.dashboard.missingMenu}
              action={<ViewFullMenuLink />}
            />
          )}
      </div>
    </div>
  );
}

export function TodayShuttleSection({
  isLoading,
  buses,
  specialPeriods,
  now,
}: {
  isLoading: boolean;
  buses?: ShuttleBusSchedule[];
  specialPeriods?: ShuttleSpecialPeriods;
  now: Date | null;
}) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const summary = getCurrentShuttleSummary({
    buses,
    specialPeriods,
    now,
    limit: 3,
  });
  const primaryDeparture = summary.departures[0];

  return (
    <div>
      <SectionTitle title={dictionary.home.dashboard.shuttle} />
      <div className="space-y-3">
        {isLoading && <Skeleton count={2} />}
        {!isLoading && summary.isWeekend && (
          <StateCard
            type="info"
            message={dictionary.home.dashboard.shuttleWeekend}
            action={
              <Link
                href={localizePath("/campus/bus-info", locale)}
                className="inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
              >
                {dictionary.home.dashboard.shuttleSchedule}
              </Link>
            }
          />
        )}
        {!isLoading && !summary.isWeekend && !summary.isOperatingPeriod && (
          <StateCard
            type="info"
            message={dictionary.home.dashboard.shuttleOutOfPeriod}
            action={
              <Link
                href={localizePath("/campus/bus-info", locale)}
                className="inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
              >
                {dictionary.home.dashboard.shuttleSchedule}
              </Link>
            }
          />
        )}
        {!isLoading &&
          !summary.isWeekend &&
          summary.isOperatingPeriod &&
          !primaryDeparture &&
          !summary.hasMoreToday && (
            <StateCard
              type="info"
              message={dictionary.home.dashboard.shuttleNoMore}
              action={
                <Link
                  href={localizePath("/campus/bus-info", locale)}
                  className="inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                >
                  {dictionary.home.dashboard.shuttleSchedule}
                </Link>
              }
            />
          )}
        {!isLoading && primaryDeparture && (
          <Link href={localizePath("/campus/bus-info", locale)} className="block">
            <Card className="cursor-pointer border border-primary-100 bg-primary-50/70 hover:shadow-card-hover">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge color="blue" size="sm">
                      {summary.scheduleLabel}
                    </Badge>
                    {summary.isSpecialSchedule && (
                      <Badge color="purple" size="sm">
                        {dictionary.home.dashboard.specialSchedule}
                      </Badge>
                    )}
                  </div>
                  <h3 className="truncate text-base font-semibold text-neutral-900">
                    {primaryDeparture.routeName}
                  </h3>
                  <p className="mt-1 text-sm text-neutral-600">
                    {primaryDeparture.time} {dictionary.home.dashboard.departs}
                  </p>
                </div>
                <div className="flex items-end justify-between gap-3 sm:block sm:text-right">
                  <p className="text-3xl font-bold leading-none text-primary-700">
                    {primaryDeparture.minutesUntil}
                    <span className="ml-1 text-base font-semibold">
                      {dictionary.home.dashboard.minutesAfter}
                    </span>
                  </p>
                </div>
              </div>

              {summary.departures.length > 1 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {summary.departures.slice(1).map((departure) => (
                    <div
                      key={`${departure.routeName}-${departure.time}`}
                      className="rounded-lg border border-white/80 bg-white/80 px-3 py-2"
                    >
                      <p className="truncate text-xs font-semibold text-neutral-800">
                        {departure.routeName}
                      </p>
                      <p className="mt-1 text-xs text-neutral-600">
                        {departure.time} {dictionary.home.dashboard.departs} ·{" "}
                        {departure.minutesUntil}
                        {dictionary.home.dashboard.minutesAfter}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}

export function TodaySchedulesSection({
  isLoading,
  schedules,
}: {
  isLoading: boolean;
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
      <div className="space-y-4">
        {isLoading && <Skeleton count={2} />}
        {!isLoading &&
          (schedules.length === 0 ? (
            <StateCard
              type="info"
              message={dictionary.home.dashboard.scheduleEmpty}
            />
          ) : (
            schedules.map((schedule) => (
              <div key={schedule.id} className="mb-3">
                <Link href={localizePath("/academic/schedule", locale)}>
                  <Card className="cursor-pointer hover:shadow-card-hover">
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge
                          color={schedule.category === "exam" ? "red" : "blue"}
                          size="sm"
                        >
                          {getCategoryLabel(schedule.category, locale)}
                        </Badge>
                        <h3 className="mt-2 font-semibold text-neutral-900">
                          {schedule.title}
                        </h3>
                        <p className="mt-1 text-xs text-neutral-600">
                          {formatDate(schedule.startDate)} ~{" "}
                          {formatDate(schedule.endDate)}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-neutral-600">
                        {schedule.category === "exam"
                          ? dictionary.home.dashboard.exam
                          : dictionary.home.dashboard.schedule}
                      </span>
                    </div>
                  </Card>
                </Link>
              </div>
            ))
          ))}
      </div>
    </div>
  );
}

function SectionTitle({ title, href }: { title: string; href?: string }) {
  const locale = useLocale();
  const dictionary = useDictionary();

  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
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

function TodayMenuCard({ todayMenu }: { todayMenu: CafeteriaMenu }) {
  const dictionary = useDictionary();
  const locale = useLocale();

  return (
    <Link href={localizePath("/campus/cafeteria", locale)}>
      <Card className="cursor-pointer border border-neutral-200 hover:shadow-card-hover">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge color="green" size="sm">
                {dictionary.home.dashboard.todayMenu}
              </Badge>
              <span className="text-xs font-medium text-neutral-500">
                {todayMenu.date}
              </span>
            </div>
            <h3 className="mb-2 font-semibold text-neutral-900">
              {todayMenu.location}
            </h3>
            <div className="space-y-2">
              <MealPreview
                title={dictionary.home.dashboard.breakfast}
                items={todayMenu.breakfast}
                count={2}
              />
              <div>
                <p className="mb-1 text-xs text-neutral-500">
                  {dictionary.home.dashboard.lunch}
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {todayMenu.lunch.a && (
                    <MealCorner
                      title={dictionary.home.dashboard.cornerA}
                      items={todayMenu.lunch.a}
                    />
                  )}
                  {todayMenu.lunch.b && (
                    <MealCorner
                      title={dictionary.home.dashboard.cornerB}
                      items={todayMenu.lunch.b}
                    />
                  )}
                </div>
              </div>
              <MealPreview
                title={dictionary.home.dashboard.dinner}
                items={todayMenu.dinner}
                count={2}
              />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function PendingMenuCard() {
  const dictionary = useDictionary();
  const locale = useLocale();

  return (
    <Link href={localizePath("/campus/cafeteria", locale)}>
      <Card className="cursor-pointer border border-neutral-200 bg-neutral-50 hover:shadow-card-hover">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Badge color="yellow" size="sm" className="mb-2">
              {dictionary.home.dashboard.todayMenu}
            </Badge>
            <h3 className="mb-2 font-semibold text-neutral-900">
              {dictionary.home.dashboard.pendingMenuTitle}
            </h3>
            <p className="text-sm leading-6 text-neutral-600">
              {dictionary.home.dashboard.pendingMenuMessage}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function ViewFullMenuLink() {
  const dictionary = useDictionary();
  const locale = useLocale();

  return (
    <Link
      href={localizePath("/campus/cafeteria", locale)}
      className="inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
    >
      {dictionary.home.dashboard.fullMenu}
    </Link>
  );
}

function MealPreview({
  title,
  items,
  count,
}: {
  title: string;
  items: Array<{ name: string }>;
  count: number;
}) {
  const dictionary = useDictionary();

  if (isClosedMealItems(items)) {
    return (
      <div>
        <p className="mb-1 text-xs text-neutral-500">{title}</p>
        <p className="text-sm text-neutral-700">
          {dictionary.home.dashboard.closedMeal}
        </p>
      </div>
    );
  }

  const previewItems = items.slice(0, count).map((item) => item.name);
  const suffix = items.length > count ? dictionary.home.dashboard.extraItems : "";

  return (
    <div>
      <p className="mb-1 text-xs text-neutral-500">{title}</p>
      <p className="text-sm text-neutral-700">
        {previewItems.join(", ")}
        {suffix}
      </p>
    </div>
  );
}

function MealCorner({
  title,
  items,
}: {
  title: string;
  items: Array<{ name: string }>;
}) {
  const dictionary = useDictionary();

  if (isClosedMealItems(items)) {
    return (
      <div>
        <p className="mb-1 text-xs font-medium text-green-700">{title}</p>
        <p className="text-neutral-700">
          {dictionary.home.dashboard.closedMeal}
        </p>
      </div>
    );
  }

  const previewItems = items.slice(0, 1).map((item) => item.name);
  const suffix = items.length > 1 ? dictionary.home.dashboard.extraItems : "";

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-green-700">{title}</p>
      <p className="text-neutral-700">
        {previewItems.join(", ")}
        {suffix}
      </p>
    </div>
  );
}

function getNoticeListPath(selectedCategory?: HomeNoticeCategory) {
  if (selectedCategory === "scholarship") return "/academic/scholarship";
  if (selectedCategory === "campus") return "/campus/announcements";
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
  if (selectedCategory === "service") return dictionary.home.notices.serviceAll;
  if (selectedCategory === "academic") {
    return dictionary.home.notices.academicAll;
  }
  return dictionary.home.notices.allNotices;
}
