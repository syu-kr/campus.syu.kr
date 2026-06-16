"use client";

import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { Skeleton } from "@/app/components/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { fetchAcademicSchedules } from "@/lib/api";
import { formatDateRange } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";

const THIRTY_MINUTES = 30 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

export default function SchedulePage() {
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.pages.academicSchedule;
  const { data: schedules, isLoading } = useQuery({
    queryKey: ["schedules"],
    queryFn: () => fetchAcademicSchedules(),
    staleTime: THIRTY_MINUTES,
    gcTime: ONE_HOUR,
  });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 2));
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;
    setSelectedDate(todayStr);
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth()));
  }, []);

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
    if (!schedules) return new Map();

    const map = new Map<string, boolean>();
    schedules.forEach((schedule) => {
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
        map.set(dateStr, schedule.category === "exam");
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
      const isSelected = selectedDate === dateStr;

      cells.push(
        <button
          key={day}
          onClick={() => setSelectedDate(dateStr)}
          className={`relative flex min-h-[48px] flex-col items-center justify-center overflow-hidden rounded-lg px-1 py-1 text-center text-sm transition-colors sm:min-h-[58px] sm:px-2 sm:py-2 ${
            isSelected
              ? "bg-primary-600 text-white"
              : hasEvent
                ? "bg-neutral-100 hover:bg-neutral-200"
                : "hover:bg-neutral-50"
          }`}
        >
          <div className="shrink-0 font-medium leading-5">{day}</div>
          {hasEvent && (
            <div className="mt-0.5 flex min-w-0 shrink-0 justify-center sm:mt-1">
              {hasExam ? (
                <span className="max-w-full whitespace-nowrap rounded bg-red-50 px-1 py-0.5 text-[9px] font-semibold leading-none text-red-700 sm:text-[10px]">
                  {text.exam}
                </span>
              ) : (
                <span className="max-w-full whitespace-nowrap rounded bg-blue-50 px-1 py-0.5 text-[9px] font-semibold leading-none text-blue-700 sm:text-[10px]">
                  {text.schedule}
                </span>
              )}
            </div>
          )}
        </button>,
      );
    }

    days.push(
      <div key="grid" className="grid grid-cols-7 gap-1 sm:gap-2">
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
  const getScheduleTypeLabel = (category: string) =>
    category === "exam" ? text.exam : text.schedule;

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          {text.title}
        </h1>
        <p className="text-neutral-600">{text.description}</p>
      </div>

      {isLoading ? (
        <Skeleton count={4} height="100px" />
      ) : (
        <div className="space-y-6">
          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() =>
                  setCurrentMonth(
                    new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth() - 1,
                    ),
                  )
                }
                className="px-3 py-1 rounded-lg bg-neutral-200 hover:bg-neutral-300 text-sm"
              >
                ←
              </button>
              <h2 className="text-lg font-semibold text-neutral-900">
                {currentMonthLabel}
              </h2>
              <button
                onClick={() =>
                  setCurrentMonth(
                    new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth() + 1,
                    ),
                  )
                }
                className="px-3 py-1 rounded-lg bg-neutral-200 hover:bg-neutral-300 text-sm"
              >
                →
              </button>
            </div>
            {renderCalendar()}
            <div className="mt-4 flex items-center gap-4 text-xs text-neutral-600">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span>{text.exam}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span>{text.event}</span>
              </div>
            </div>
          </Card>

          {selectedDate && (
            <>
              <Card className="p-6 bg-blue-50 border border-blue-200">
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
                        <span className="text-xs font-semibold text-primary-600 mt-1 px-2 py-1 rounded bg-primary-50">
                          {getScheduleTypeLabel(schedule.category)}
                        </span>
                        <div>
                          <p className="font-medium">{schedule.title}</p>
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
            <div className="flex items-center gap-2 mb-4">
              <input
                type="text"
                placeholder={text.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="px-3 py-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                  title={text.resetSearch}
                >
                  ✕
                </button>
              )}
            </div>

            {searchQuery.trim().length > 0 && (
              <div className="space-y-6 mt-4">
                {(() => {
                  const filteredSchedules = schedules
                    ? schedules.filter((schedule) =>
                        schedule.title
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase()),
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
                                    <h4 className="font-medium text-sm text-neutral-900">
                                      {schedule.title}
                                    </h4>
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
                                  {getScheduleTypeLabel(schedule.category)}
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

          <div className="space-y-6">
            {Object.entries(groupedByMonth)
              .sort()
              .map(([month, items]) => (
                <div key={month}>
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-neutral-300">
                    <h2 className="text-lg font-semibold text-neutral-900">
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
                              <h3 className="font-semibold text-neutral-900">
                                {schedule.title}
                              </h3>
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
                            {getScheduleTypeLabel(schedule.category)}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </Container>
  );
}
