import Link from "next/link";
import { Badge } from "@/app/components/Badge";
import { Card } from "@/app/components/Card";
import {
  HomeNoticeCard,
  ServiceNoticeCard,
} from "@/app/components/HomeNoticeCard";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { isCafeteriaClosedDay, isClosedMealItems } from "@/lib/cafeteria";
import { getCurrentShuttleSummary } from "@/lib/shuttle-schedule";
import { formatDate, getCategoryLabel } from "@/lib/utils";
import type {
  AcademicSchedule,
  CafeteriaMenu,
  HomeNoticeCategory,
  ServiceNotice,
  ShuttleBusSchedule,
  ShuttleSpecialPeriods,
} from "@/types";
import type { HomeNotice, TodayInfo } from "@/lib/home";

const categoryFilters: Array<{
  id: string;
  label: string;
  value: HomeNoticeCategory | undefined;
}> = [
  { id: "all", label: "전체", value: undefined },
  { id: "academic", label: "학사공지", value: "academic" },
  { id: "scholarship", label: "장학금", value: "scholarship" },
  { id: "campus", label: "캠퍼스", value: "campus" },
  { id: "service", label: "서비스공지", value: "service" },
];

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
  return (
    <div className="border-b border-neutral-200 pb-4 sm:pb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">공지사항</h2>
        <Link
          href={getNoticeListPath(selectedCategory)}
          className="text-xs text-primary-600 hover:text-primary-700"
        >
          {getNoticeListLabel(selectedCategory)} →
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
              <StateCard type="info" message="선택한 서비스 공지가 없습니다." />
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
                    message="선택한 분류에 공지사항이 없습니다."
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
}: {
  isLoading: boolean;
  todayInfo: TodayInfo;
  todayMenu: CafeteriaMenu | null;
}) {
  return (
    <div>
      <SectionTitle title="학식" />
      <div className="space-y-3">
        {isLoading && <Skeleton count={2} />}
        {!isLoading && todayInfo.isWeekend && (
          <StateCard
            type="info"
            message="오늘은 주말입니다. 주말을 알차게 보내보는건 어떨까요?"
            action={<ViewFullMenuLink />}
          />
        )}
        {!isLoading &&
          !todayInfo.isWeekend &&
          todayMenu &&
          isCafeteriaClosedDay(todayMenu) && (
            <StateCard
              type="info"
              title="오늘은 운영하지 않습니다"
              message="공휴일 또는 운영하지 않는 날입니다. 전체 식단에서 다른 날짜를 확인해보세요."
              action={<ViewFullMenuLink />}
            />
          )}
        {!isLoading &&
          !todayInfo.isWeekend &&
          todayMenu &&
          !isCafeteriaClosedDay(todayMenu) && (
            <TodayMenuCard todayMenu={todayMenu} />
          )}
        {!isLoading &&
          !todayInfo.isWeekend &&
          todayInfo.dayOfWeek === 1 &&
          !todayMenu && <PendingMenuCard />}
        {!isLoading &&
          !todayInfo.isWeekend &&
          todayInfo.dayOfWeek !== 1 &&
          !todayMenu && (
            <StateCard
              type="warning"
              message="오늘 식단 정보가 없습니다. 전체 식단에서 다른 날짜를 확인해보세요."
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
  const summary = getCurrentShuttleSummary({
    buses,
    specialPeriods,
    now,
    limit: 3,
  });
  const primaryDeparture = summary.departures[0];

  return (
    <div>
      <SectionTitle title="다음 셔틀" />
      <div className="space-y-3">
        {isLoading && <Skeleton count={2} />}
        {!isLoading && summary.isWeekend && (
          <StateCard
            type="info"
            message="오늘은 주말입니다. 셔틀버스가 운행되지 않습니다."
            action={
              <Link
                href="/campus/bus-info"
                className="inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
              >
                셔틀 시간표 보기
              </Link>
            }
          />
        )}
        {!isLoading &&
          !summary.isWeekend &&
          !primaryDeparture &&
          !summary.hasMoreToday && (
            <StateCard
              type="info"
              message="오늘 남은 셔틀 운행이 없습니다. 전체 시간표를 확인해보세요."
              action={
                <Link
                  href="/campus/bus-info"
                  className="inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                >
                  셔틀 시간표 보기
                </Link>
              }
            />
          )}
        {!isLoading && primaryDeparture && (
          <Link href="/campus/bus-info" className="block">
            <Card className="cursor-pointer border border-primary-100 bg-primary-50/70 hover:shadow-card-hover">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge color="blue" size="sm">
                      {summary.scheduleLabel}
                    </Badge>
                    {summary.isSpecialSchedule && (
                      <Badge color="purple" size="sm">
                        특별운행
                      </Badge>
                    )}
                  </div>
                  <h3 className="truncate text-base font-semibold text-neutral-900">
                    {primaryDeparture.routeName}
                  </h3>
                  <p className="mt-1 text-sm text-neutral-600">
                    {primaryDeparture.time} 출발
                  </p>
                </div>
                <div className="flex items-end justify-between gap-3 sm:block sm:text-right">
                  <p className="text-3xl font-bold leading-none text-primary-700">
                    {primaryDeparture.minutesUntil}
                    <span className="ml-1 text-base font-semibold">분 뒤</span>
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
                        {departure.time} 출발 · {departure.minutesUntil}분 뒤
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
  return (
    <div>
      <SectionTitle title="오늘의 일정" href="/academic/schedule" />
      <div className="space-y-4">
        {isLoading && <Skeleton count={2} />}
        {!isLoading &&
          (schedules.length === 0 ? (
            <StateCard type="info" message="오늘 일정이 없습니다." />
          ) : (
            schedules.map((schedule) => (
              <div key={schedule.id} className="mb-3">
                <Link href="/academic/schedule">
                  <Card className="cursor-pointer hover:shadow-card-hover">
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge
                          color={schedule.category === "exam" ? "red" : "blue"}
                          size="sm"
                        >
                          {getCategoryLabel(schedule.category)}
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
                        {schedule.category === "exam" ? "시험" : "일정"}
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
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      {href && (
        <Link
          href={href}
          className="text-xs text-primary-600 hover:text-primary-700"
        >
          전체보기 →
        </Link>
      )}
    </div>
  );
}

function TodayMenuCard({ todayMenu }: { todayMenu: CafeteriaMenu }) {
  return (
    <Link href="/campus/cafeteria">
      <Card className="cursor-pointer border-2 border-green-400 bg-gradient-to-r from-green-50 to-green-100 hover:shadow-card-hover">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-1 text-sm font-semibold text-green-700">
              오늘의 메뉴
            </div>
            <h3 className="mb-2 font-semibold text-neutral-900">
              {todayMenu.location}
            </h3>
            <div className="space-y-2">
              <MealPreview title="조식" items={todayMenu.breakfast} count={2} />
              <div>
                <p className="mb-1 text-xs text-neutral-500">중식</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {todayMenu.lunch.a && (
                    <MealCorner title="A 코너" items={todayMenu.lunch.a} />
                  )}
                  {todayMenu.lunch.b && (
                    <MealCorner title="B 코너" items={todayMenu.lunch.b} />
                  )}
                </div>
              </div>
              <MealPreview title="석식" items={todayMenu.dinner} count={2} />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function PendingMenuCard() {
  return (
    <Link href="/campus/cafeteria">
      <Card className="cursor-pointer border-2 border-yellow-400 bg-gradient-to-r from-yellow-50 to-yellow-100 hover:shadow-card-hover">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-1 text-sm font-semibold text-yellow-700">
              오늘의 메뉴
            </div>
            <h3 className="mb-2 font-semibold text-neutral-900">
              식단 준비 중입니다
            </h3>
            <p className="text-sm text-yellow-700">
              데이터가 준비되고 있습니다. 잠시만 기다려주세요.
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function ViewFullMenuLink() {
  return (
    <Link
      href="/campus/cafeteria"
      className="inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
    >
      전체 식단 보기
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
  if (isClosedMealItems(items)) {
    return (
      <div>
        <p className="mb-1 text-xs text-neutral-500">{title}</p>
        <p className="text-sm text-neutral-700">운영 없음</p>
      </div>
    );
  }

  const previewItems = items.slice(0, count).map((item) => item.name);
  const suffix = items.length > count ? " 외" : "";

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
  if (isClosedMealItems(items)) {
    return (
      <div>
        <p className="mb-1 text-xs font-medium text-green-700">{title}</p>
        <p className="text-neutral-700">운영 없음</p>
      </div>
    );
  }

  const previewItems = items.slice(0, 1).map((item) => item.name);
  const suffix = items.length > 1 ? " 외" : "";

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
  if (selectedCategory === "scholarship") return "/more/scholarship";
  if (selectedCategory === "campus") return "/campus/announcements";
  if (selectedCategory === "service") return "/service/notices";
  if (selectedCategory === "academic") return "/academic/announcements";
  return "/announcements";
}

function getNoticeListLabel(selectedCategory?: HomeNoticeCategory) {
  if (selectedCategory === "scholarship") return "장학금 전체보기";
  if (selectedCategory === "campus") return "캠퍼스공지 전체보기";
  if (selectedCategory === "service") return "서비스공지 전체보기";
  if (selectedCategory === "academic") return "학사공지 전체보기";
  return "전체 공지 보기";
}
