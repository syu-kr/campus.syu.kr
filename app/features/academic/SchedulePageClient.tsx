"use client";

import { Container } from "@/app/components/Container";
import { Button, buttonStyles } from "@/app/components/Button";
import { Card } from "@/app/components/Card";
import { PublicContentTranslation } from "@/app/components/ContentTranslation";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { SourceAttribution } from "@/app/components/SourceAttribution";
import { Icon } from "@/app/components/Icon";
import { useQuery } from "@tanstack/react-query";
import { fetchAcademicSchedules, fetchPublicHolidays } from "@/lib/api";
import { emptyPublicHolidays, formatPublicHolidayName, getPublicHoliday, mergePublicHolidays } from "@/lib/public-holidays";
import { getKoreaNow, getTodayInfo } from "@/lib/home";
import { formatDateRange } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { useUrlSearch } from "@/lib/use-url-search";
import type { AcademicSchedule, AnswerSource } from "@/types";
import type { PublicHolidaySnapshot } from "@/types/public-holidays";
import "./academic-schedule.css";
import "@/app/components/page-motion.css";

const THIRTY_MINUTES = 30 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const FIVE_MINUTES = 5 * 60 * 1000;

type SchedulePageClientProps = {
  initialDateStringDot: string;
  initialNowIso: string;
  initialSchedules: AcademicSchedule[];
  initialPublicHolidays?: PublicHolidaySnapshot;
};

export default function SchedulePageClient({
  initialDateStringDot,
  initialNowIso,
  initialSchedules,
  initialPublicHolidays,
}: SchedulePageClientProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.pages.academicSchedule;
  const holidayText = dictionary.publicHolidays;
  const scheduleTitle = (schedule: AcademicSchedule) => schedule.id.startsWith("public-holiday-") ? schedule.title.split(" · ").map(name => formatPublicHolidayName(name, locale)).join(" · ") : schedule.title;
  const [now, setNow] = useState(() => new Date(initialNowIso));
  const { data: academicSchedules, isLoading, isError, refetch } = useQuery({
    queryKey: ["schedules"],
    queryFn: () => fetchAcademicSchedules(),
    initialData: initialSchedules,
    staleTime: THIRTY_MINUTES,
    gcTime: ONE_HOUR,
  });
  const {
    data: holidaySnapshot,
    isError: publicHolidaysError,
    refetch: refetchPublicHolidays,
  } = useQuery({
    queryKey: ["public-holidays"],
    queryFn: () => fetchPublicHolidays(),
    initialData: initialPublicHolidays,
    staleTime: FIVE_MINUTES,
    refetchInterval: FIVE_MINUTES,
  });
  useEffect(() => {
    setNow(getKoreaNow());
    const timer = setInterval(() => setNow(getKoreaNow()), 60 * 1000);
    return () => clearInterval(timer);
  }, [academicSchedules, holidaySnapshot]);
  const publicHolidays = useMemo(() => {
    const snapshot = holidaySnapshot ?? emptyPublicHolidays();
    return publicHolidaysError ? { ...snapshot, stale: true } : snapshot;
  }, [holidaySnapshot, publicHolidaysError]);
  const schedules = useMemo(
    () => mergePublicHolidays(academicSchedules ?? [], publicHolidays),
    [academicSchedules, publicHolidays],
  );
  const todayInfo = getTodayInfo(now);
  const thisMonthKey = todayInfo.dateStringDot.slice(0, 7);
  const holidayInfo = getPublicHoliday(todayInfo.dateStringDash, publicHolidays, now);
  const holidayCovered = publicHolidays.years.includes(Number(todayInfo.dateStringDash.slice(0, 4)));
  const sources: AnswerSource[] = [
    {
      name: text.title,
      url: "https://www.syu.ac.kr/academic/major-schedule/",
      note: isError ? dictionary.home.dashboard.loadFailedMessage : undefined,
    },
    {
      name: holidayText.source,
      url: publicHolidays.sourceUrl,
      note: !holidayCovered ? holidayText.unavailable : holidayInfo.isStale ? holidayText.stale : undefined,
    },
  ];

  const initialMonth = useMemo(
    () => parseDateStringDot(initialDateStringDot),
    [initialDateStringDot],
  );
  const [selectedDate, setSelectedDate] =
    useState<string | null>(initialDateStringDot);
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(initialMonth.getFullYear(), initialMonth.getMonth()),
  );
  const [searchQuery, setSearchQuery] = useUrlSearch();
  const monthHolidayInfo = getPublicHoliday(
    `${currentMonth.getFullYear()}.${String(currentMonth.getMonth() + 1).padStart(2, "0")}.01`,
    publicHolidays,
    now,
  );
  const hasMonthHolidayCoverage = Boolean(
    publicHolidays?.lastSuccessAt &&
    publicHolidays.years.includes(currentMonth.getFullYear()),
  );
  const groupedByMonth = useMemo(() => {
    if (!schedules) return {};

    const months: Record<string, typeof schedules> = {};
    schedules.forEach((schedule) => {
      const monthKey = schedule.startDate.substring(0, 7);
      if (!months[monthKey]) {
        months[monthKey] = [];
      }
      months[monthKey].push(schedule);
    });

    return months;
  }, [schedules]);

  const selectedDateSchedules = useMemo(() => {
    if (!schedules || !selectedDate) return [];
    return schedules.filter(
      (s) =>
        s.startDate === selectedDate ||
        (selectedDate >= s.startDate && selectedDate <= s.endDate),
    );
  }, [schedules, selectedDate]);

  const monthSchedules = useMemo(() => {
    const map = new Set<string>();
    schedules.forEach((schedule) => {
      if (schedule.id.startsWith("public-holiday-")) return;
      const [startYear, startMonth, startDay] = schedule.startDate.split(".");
      const [endYear, endMonth, endDay] = schedule.endDate.split(".");

      const start = new Date(
        parseInt(startYear),
        parseInt(startMonth) - 1,
        parseInt(startDay),
      );
      const end = new Date(
        parseInt(endYear),
        parseInt(endMonth) - 1,
        parseInt(endDay),
      );

      const current = new Date(start);
      while (current <= end) {
        const dateStr = `${current.getFullYear()}.${String(current.getMonth() + 1).padStart(2, "0")}.${String(current.getDate()).padStart(2, "0")}`;
        map.add(dateStr);
        current.setDate(current.getDate() + 1);
      }
    });

    return map;
  }, [schedules]);

  const hasExamInMonth = useMemo(() => {
    if (!schedules) return new Set<string>();

    const examDates = new Set<string>();
    schedules.forEach((schedule) => {
      if (schedule.category === "exam") {
        const [startYear, startMonth, startDay] = schedule.startDate.split(".");
        const [endYear, endMonth, endDay] = schedule.endDate.split(".");

        const start = new Date(
          parseInt(startYear),
          parseInt(startMonth) - 1,
          parseInt(startDay),
        );
        const end = new Date(
          parseInt(endYear),
          parseInt(endMonth) - 1,
          parseInt(endDay),
        );

        const currDate = new Date(start);
        while (currDate <= end) {
          const dateStr = `${currDate.getFullYear()}.${String(currDate.getMonth() + 1).padStart(2, "0")}.${String(currDate.getDate()).padStart(2, "0")}`;
          examDates.add(dateStr);
          currDate.setDate(currDate.getDate() + 1);
        }
      }
    });

    return examDates;
  }, [schedules]);

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    const weekDays = text.weekDays;

    days.push(
      <div key="header" className="mb-2 grid grid-cols-7 gap-1 sm:mb-3 sm:gap-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-semibold text-neutral-600"
          >
            {day}
          </div>
        ))}
      </div>,
    );

    const cells = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}.${String(month + 1).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
      const hasEvent = monthSchedules.has(dateStr);
      const hasExam = hasExamInMonth.has(dateStr);
      const holiday = getPublicHoliday(dateStr, publicHolidays);
      const isHoliday = holiday.status === "holiday";
      const isSelected = selectedDate === dateStr;

      cells.push(
        <button
          type="button"
          key={day}
          aria-label={`${formatDateRange(dateStr, dateStr, locale)}${isHoliday ? `, ${holidayText.label}: ${holiday.names.map(name => formatPublicHolidayName(name, locale)).join(", ")}` : ""}${hasEvent ? `, ${hasExam ? text.exam : text.schedule}` : ""}`}
          aria-pressed={isSelected}
          aria-current={dateStr === initialDateStringDot ? "date" : undefined}
          onClick={() => setSelectedDate(dateStr)}
          data-has-event={hasEvent || isHoliday}
          className={`m3-calendar-day relative flex min-h-[58px] flex-col items-center justify-center overflow-hidden rounded-lg px-1 py-1 text-center text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 sm:min-h-[64px] sm:px-2 sm:py-2 ${
            isSelected
              ? "bg-primary-600 text-white"
              : hasEvent || isHoliday
                ? "bg-neutral-100 hover:bg-neutral-200"
                : "hover:bg-neutral-50"
          }`}
        >
          <div className={`shrink-0 font-medium leading-5 ${isHoliday && !isSelected ? "text-red-700" : ""}`}>
            {day}
          </div>
          {isHoliday && (
            <span data-kind="holiday" className="m3-calendar-marker mt-0.5 max-w-full whitespace-nowrap rounded bg-red-50 px-1 py-0.5 text-[9px] font-semibold leading-none text-red-700 sm:text-[10px]">
              {holidayText.label}
            </span>
          )}
          {hasEvent && (
            <div className="mt-0.5 flex min-w-0 shrink-0 justify-center sm:mt-1">
              {hasExam ? (
                <span data-kind="exam" className="m3-calendar-marker max-w-full whitespace-nowrap rounded bg-red-50 px-1 py-0.5 text-[9px] font-semibold leading-none text-red-700 sm:text-[10px]">
                  {text.exam}
                </span>
              ) : (
                <span data-kind="schedule" className="m3-calendar-marker max-w-full whitespace-nowrap rounded bg-blue-50 px-1 py-0.5 text-[9px] font-semibold leading-none text-blue-700 sm:text-[10px]">
                  {text.schedule}
                </span>
              )}
            </div>
          )}
        </button>,
      );
    }

    days.push(
      <div key="grid" className="m3-calendar-month-grid grid grid-cols-7 gap-1 sm:gap-2" data-motion-phase={currentMonth.getMonth() % 2}>
        {cells}
      </div>,
    );

    return days;
  };
  const selectedDateLabel = selectedDate
    ? formatDateRange(selectedDate, selectedDate, locale)
    : "";
  const selectedDateTitle = `${text.selectedDatePrefix}${selectedDateLabel}${text.selectedDateSuffix}`;
  const currentMonthLabel =
    locale === "ko"
      ? `${currentMonth.getFullYear()}년 ${String(currentMonth.getMonth() + 1).padStart(2, "0")}월`
      : currentMonth.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
        });
  const formatItemCount = (count: number) =>
    `${text.itemCountPrefix}${count}${text.itemCountSuffix}`;
  const getScheduleTypeLabel = (schedule: AcademicSchedule) =>
    schedule.id.startsWith("public-holiday-")
      ? holidayText.label
      : schedule.category === "exam"
        ? text.exam
        : text.schedule;

  return (
    <Container className="m3-schedule-page py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          {text.title}
        </h1>
        <p className="text-neutral-600">{text.description}</p>
      </div>

      {isError && (
        <StateCard
          type="error"
          className="mb-6"
          title={dictionary.home.dashboard.loadFailedTitle}
          message={dictionary.home.dashboard.loadFailedMessage}
          action={
            <Button
              onClick={() => refetch()}
            >
              {dictionary.home.dashboard.retry}
            </Button>
          }
        />
      )}

      {isLoading ? (
        <Skeleton count={4} height="100px" />
      ) : isError && (!schedules || schedules.length === 0) ? null : (
        <div className="space-y-6">
          <Card className="m3-schedule-calendar p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <button
                type="button"
                aria-label={text.previousMonth}
                onClick={() =>
                  setCurrentMonth(
                    new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth() - 1,
                    ),
                  )
                }
                className={buttonStyles("secondary", "m3-icon-button")}
              >
                <Icon name="chevron-right" size={22} className="rotate-180" />
              </button>
              <h2 className="text-lg font-semibold text-neutral-900">
                {currentMonthLabel}
              </h2>
              <button
                type="button"
                aria-label={text.nextMonth}
                onClick={() =>
                  setCurrentMonth(
                    new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth() + 1,
                    ),
                  )
                }
                className={buttonStyles("secondary", "m3-icon-button")}
              >
                <Icon name="chevron-right" size={22} />
              </button>
            </div>
            {renderCalendar()}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-neutral-600">
              <div className="flex items-center gap-2">
                <span data-kind="holiday" className="m3-calendar-marker rounded bg-red-50 px-1 py-0.5 font-semibold text-red-700">{holidayText.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span>{text.exam}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span>{text.event}</span>
              </div>
            </div>
            {(monthHolidayInfo.status === "unknown" || monthHolidayInfo.isStale || publicHolidaysError) && (
              <p role="status" className="mt-3 text-xs leading-relaxed text-amber-800">
                {!hasMonthHolidayCoverage ? holidayText.unavailable : holidayText.stale}
                {publicHolidaysError && (
                  <Button variant="secondary" onClick={() => refetchPublicHolidays()} className="ml-2">
                    {dictionary.home.dashboard.retry}
                  </Button>
                )}
              </p>
            )}
          </Card>

          {selectedDate && (
            <>
              <Card className="m3-schedule-selected p-6 bg-blue-50 border border-blue-200">
                <h3 className="font-semibold text-neutral-900 mb-3">
                  {selectedDateTitle}
                </h3>
                {selectedDateSchedules.length === 0 ? (
                  <p className="text-sm text-neutral-600">
                    {text.noSchedulesOnDate}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedDateSchedules.map((schedule) => (
                      <div
                        key={schedule.id}
                        className="text-sm text-neutral-700 flex items-start gap-2"
                      >
                        <span className={`mt-1 rounded px-2 py-1 text-xs font-semibold ${
                          schedule.id.startsWith("public-holiday-")
                            ? "bg-red-50 text-red-700"
                            : "bg-primary-50 text-primary-600"
                        }`}>
                          {getScheduleTypeLabel(schedule)}
                        </span>
                        <div>
                          <PublicContentTranslation source={{ kind: "schedule", id: schedule.id }} content={schedule.id.startsWith("public-holiday-") ? {} : { title: schedule.title }}>{translation => <p lang={schedule.id.startsWith("public-holiday-") ? locale : translation.lang} className="font-medium">{translation.text("title", scheduleTitle(schedule))}</p>}</PublicContentTranslation>
                          <p className="text-xs text-neutral-600">
                            {formatDateRange(
                              schedule.startDate,
                              schedule.endDate,
                              locale,
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              <div className="border-b border-neutral-300"></div>
            </>
          )}

          <Card className="p-6">
            <div className="m3-schedule-search flex items-center gap-2 mb-4">
              <input
                type="text"
                placeholder={text.searchPlaceholder}
                aria-label={text.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-w-0 flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  onClick={() => setSearchQuery("")}
                  className="m3-icon-button shrink-0"
                  title={text.resetSearch}
                  aria-label={text.resetSearch}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
                </Button>
              )}
            </div>

            {!searchQuery.trim() && Boolean(groupedByMonth[thisMonthKey]?.length) && (
              <a
                href={`#schedule-month-${thisMonthKey.replace(".", "-")}`}
                className={buttonStyles("secondary", "mt-2")}
              >
                {text.currentMonthSchedules}
              </a>
            )}

            {searchQuery.trim().length > 0 && (
              <div className="space-y-6 mt-4">
                {(() => {
                  const filteredSchedules = schedules
                    ? schedules.filter((schedule) =>
                        schedule.title
                          .toLowerCase()
                          .includes(searchQuery.trim().toLowerCase()),
                      )
                    : [];

                  if (filteredSchedules.length === 0) {
                    return (
                      <div className="text-center py-6">
                        <p className="text-sm text-neutral-600">
                          {text.noSearchResults}
                        </p>
                      </div>
                    );
                  }

                  const searchGroupedByMonth: Record<string, typeof schedules> =
                    {};
                  filteredSchedules.forEach((schedule) => {
                    const monthKey = schedule.startDate.substring(0, 7);
                    if (!searchGroupedByMonth[monthKey]) {
                      searchGroupedByMonth[monthKey] = [];
                    }
                    searchGroupedByMonth[monthKey].push(schedule);
                  });

                  return Object.entries(searchGroupedByMonth)
                    .sort()
                    .map(([month, items]) => (
                      <div key={month}>
                        <div className="flex items-center gap-3 mb-3 pb-2 border-b border-neutral-200">
                          <h3 className="text-sm font-semibold text-neutral-900">
                            {month}
                          </h3>
                          <span className="text-xs text-neutral-600">
                            ({formatItemCount(items?.length || 0)})
                          </span>
                        </div>
                        <div className="space-y-2">
                          {items?.map((schedule) => (
                            <Card key={schedule.id} className="p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    {schedule.category === "exam" && (
                                      <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
                                    )}
                                    <PublicContentTranslation source={{ kind: "schedule", id: schedule.id }} content={schedule.id.startsWith("public-holiday-") ? {} : { title: schedule.title }}>{translation => <h4 lang={schedule.id.startsWith("public-holiday-") ? locale : translation.lang} className="font-medium text-sm text-neutral-900">{translation.text("title", scheduleTitle(schedule))}</h4>}</PublicContentTranslation>
                                  </div>
                                  <p className="text-xs text-neutral-600">
                                    {formatDateRange(
                                      schedule.startDate,
                                      schedule.endDate,
                                      locale,
                                    )}
                                  </p>
                                </div>
                                <div className="text-xs font-semibold text-neutral-600">
                                  {getScheduleTypeLabel(schedule)}
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ));
                })()}
              </div>
            )}
          </Card>

          {!searchQuery.trim() && <div className="space-y-6">
            {Object.entries(groupedByMonth)
              .sort()
              .map(([month, items]) => (
                <div key={month}>
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-neutral-300">
                    <h2
                      id={`schedule-month-${month.replace(".", "-")}`}
                      tabIndex={-1}
                      className="scroll-mt-24 text-lg font-semibold text-neutral-900"
                    >
                      {month}
                    </h2>
                    <span className="text-sm text-neutral-600">
                      ({formatItemCount(items?.length || 0)})
                    </span>
                  </div>
                  <div className="space-y-3">
                    {items?.map((schedule) => (
                      <Card key={schedule.id}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {schedule.category === "exam" && (
                                <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
                              )}
                              <PublicContentTranslation source={{ kind: "schedule", id: schedule.id }} content={schedule.id.startsWith("public-holiday-") ? {} : { title: schedule.title }}>{translation => <h3 lang={schedule.id.startsWith("public-holiday-") ? locale : translation.lang} className="font-semibold text-neutral-900">{translation.text("title", scheduleTitle(schedule))}</h3>}</PublicContentTranslation>
                            </div>
                            <p className="text-xs text-neutral-600 mb-2">
                              {formatDateRange(
                                schedule.startDate,
                                schedule.endDate,
                                locale,
                              )}
                            </p>
                          </div>
                          <div className="text-xs font-semibold text-neutral-600">
                            {getScheduleTypeLabel(schedule)}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
          </div>}
        </div>
      )}
      <SourceAttribution sources={sources} />
    </Container>
  );
}

function parseDateStringDot(value: string) {
  const [year = "", month = "1", date = "1"] = value.split(".");
  const parsedDate = new Date(
    Number(year) || new Date().getFullYear(),
    Math.max(Number(month) - 1, 0),
    Number(date) || 1,
  );

  return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
}
