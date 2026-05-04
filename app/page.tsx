"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";

import { Card } from "./components/Card";
import { Container } from "./components/Container";
import { SearchBar } from "./components/SearchBar";
import { Badge } from "./components/Badge";
import { Skeleton } from "./components/Skeleton";
import { useQuery } from "@tanstack/react-query";
import {
  fetchAnnouncementSummary,
  fetchAnnouncements,
  fetchCafeteriaMenu,
  fetchAcademicSchedules,
  searchAll,
} from "@/lib/api";
import { formatDate, getCategoryLabel } from "@/lib/utils";
import { fetchJson } from "@/lib/fetch-json";
import {
  categorizeSearchResults,
  getKoreaNow,
  getHomeNotices,
  getTodayInfo,
  isScheduleOnDate,
} from "@/lib/home";
import type { ServiceNotice } from "@/types";
import { Icon } from "./components/Icon";
import { StateCard } from "./components/StateCard";
import { HomeNoticeCard, ServiceNoticeCard } from "./components/HomeNoticeCard";
import { SearchResultsView } from "@/app/features/home/SearchResultsView";

// 자주 사용하는 메뉴
const frequentMenus = [
  { id: "1", iconName: "utensils", label: "학식", path: "/campus/cafeteria" },
  { id: "2", iconName: "bus", label: "버스 정보", path: "/campus/bus-info" },
  {
    id: "3",
    iconName: "map",
    label: "캠퍼스 지도",
    path: "/campus/map",
  },
  {
    id: "4",
    iconName: "calendar",
    label: "학사일정",
    path: "/academic/schedule",
  },
  { id: "5", iconName: "award", label: "장학금", path: "/more/scholarship" },
  { id: "6", iconName: "book-open", label: "도서관", path: "/campus/library" },
];

const categoryFilters = [
  { id: "all", label: "전체", value: undefined },
  { id: "academic", label: "학사공지", value: "academic" },
  { id: "scholarship", label: "장학금", value: "scholarship" },
  { id: "campus", label: "캠퍼스", value: "campus" },
  { id: "service", label: "서비스공지", value: "service" },
];

const ONE_MINUTE = 60 * 1000;
const FIVE_MINUTES = 5 * ONE_MINUTE;
const TEN_MINUTES = 10 * ONE_MINUTE;
const THIRTY_MINUTES = 30 * ONE_MINUTE;
const ONE_HOUR = 60 * ONE_MINUTE;

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    undefined,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  // 날짜 기반 표시만 사용하므로 분 단위로만 갱신합니다.
  useEffect(() => {
    setNow(getKoreaNow());

    const timer = setInterval(() => {
      setNow(getKoreaNow());
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // 공지사항 조회
  const {
    data: announcements,
    isLoading: announcementsLoading,
  } = useQuery({
    queryKey: ["announcements", selectedCategory],
    queryFn: () =>
      selectedCategory
        ? fetchAnnouncements(
            selectedCategory as
              | "academic"
              | "campus"
              | "admin"
              | "activity"
              | "scholarship",
          )
        : fetchAnnouncementSummary(),
    staleTime: ONE_MINUTE,
    gcTime: FIVE_MINUTES,
  });

  // 서비스 공지 조회
  const {
    data: serviceNotices,
    isLoading: serviceNoticesLoading,
  } = useQuery({
    queryKey: ["serviceNotices"],
    queryFn: () =>
      fetchJson<ServiceNotice[]>("/api/service-notices", { fallback: [] }),
    staleTime: FIVE_MINUTES,
    gcTime: TEN_MINUTES,
  });

  // 학식 조회
  const {
    data: cafeteria,
    isLoading: cafeteriaLoading,
  } = useQuery({
    queryKey: ["cafeteria"],
    queryFn: () => fetchCafeteriaMenu(),
    staleTime: FIVE_MINUTES,
    gcTime: TEN_MINUTES,
  });

  // 학사일정 조회
  const {
    data: schedules,
    isLoading: schedulesLoading,
  } = useQuery({
    queryKey: ["schedules"],
    queryFn: () => fetchAcademicSchedules(),
    staleTime: THIRTY_MINUTES,
    gcTime: ONE_HOUR,
  });

  // 검색
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["search", searchQuery],
    queryFn: () => searchAll(searchQuery),
    enabled: showSearchResults && searchQuery.trim().length > 0,
    staleTime: FIVE_MINUTES,
    gcTime: TEN_MINUTES,
  });
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setShowSearchResults(query.trim().length > 0);
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchQuery("");
    setShowSearchResults(false);
  }, []);

  // 오늘 날짜와 요일 계산
  const todayInfo = useMemo(() => getTodayInfo(now), [now]);

  // 오늘 식단 찾기
  const todayMenu = useMemo(() => {
    if (!cafeteria) return null;
    return cafeteria.find((menu) => menu.date === todayInfo.dateStringDash);
  }, [cafeteria, todayInfo]);

  const todaySchedules = useMemo(() => {
    if (!schedules) return [];
    return schedules.filter((schedule) =>
      isScheduleOnDate(schedule, todayInfo.dateStringDot),
    );
  }, [schedules, todayInfo.dateStringDot]);

  // 검색 결과를 카테고리별로 분류 (Hook의 규칙을 지키기 위해 조건 밖에서 호출)
  const categorizedResults = useMemo(() => {
    return categorizeSearchResults(showSearchResults ? searchResults : undefined);
  }, [showSearchResults, searchResults]);

  const homeNotices = useMemo(
    () => getHomeNotices(announcements, serviceNotices, selectedCategory),
    [announcements, serviceNotices, selectedCategory],
  );

  // 검색 결과 화면
  if (showSearchResults) {
    return (
      <SearchResultsView
        searchQuery={searchQuery}
        searchResults={searchResults}
        categorizedResults={categorizedResults}
        isLoading={searchLoading}
        onSearch={handleSearch}
        onClear={handleSearchClear}
      />
    );
  }

  // 홈 화면
  return (
    <Container className="py-6 sm:py-8 space-y-6">
      {/* 검색바 */}
      <SearchBar onSearch={handleSearch} className="mt-4" />

      {/* 자주 사용하는 메뉴 */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">
          자주 사용하는 메뉴
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {frequentMenus.map((menu) => (
            <Link
              key={menu.id}
              href={menu.path}
              className="flex flex-col items-center justify-center py-4 rounded-lg hover:bg-primary-50 transition-colors"
            >
              <Icon
                name={menu.iconName}
                size={32}
                color="rgb(37, 99, 235)"
                className="mb-2"
              />
              <span className="text-xs font-medium text-center text-neutral-900">
                {menu.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* 서비스 공지 위젯 */}
      <Card className="bg-gradient-to-br from-primary-500 to-primary-600 text-white">
        <div className="space-y-4">
          <div>
            <p className="text-xs opacity-90 mb-1">💡 팁</p>
            <h3 className="text-lg font-semibold">
              SYU CAMPUS를 앱처럼 설치하여 사용하세요!
            </h3>
            <p className="text-xs opacity-80 mt-2">
              PWA 설치로 더 빠르고 편리하게 접속 가능합니다
            </p>
          </div>
          <Link
            href="/service/notices/005-pwa-installation-guide"
            className="inline-block"
          >
            <button className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-all text-sm font-medium">
              설치 방법 보기 →
            </button>
          </Link>
        </div>
      </Card>

      {/* 공지사항 섹션 */}
      <div className="pb-4 sm:pb-6 border-b border-neutral-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-neutral-900">공지사항</h2>
          <Link
            href={
              selectedCategory === "scholarship"
                ? "/more/scholarship"
                : selectedCategory === "campus"
                  ? "/campus/announcements"
                  : selectedCategory === "service"
                    ? "/service/notices"
                    : "/academic/announcements"
            }
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            전체보기 →
          </Link>
        </div>

        {/* 카테고리 필터 */}
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
          {categoryFilters.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.value
                  ? "bg-primary-600 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 공지사항 목록 */}
        <div className="space-y-3">
          {selectedCategory === "service" ? (
            // 서비스 공지만 표시
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
                  message="선택한 서비스 공지가 없습니다."
                />
              )}
            </>
          ) : (
            // 일반 공지 + 서비스 공지 혼합 표시
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

      {/* 학식 정보 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-neutral-900">학식</h2>
          <Link
            href="/campus/cafeteria"
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            전체보기 →
          </Link>
        </div>
        <div className="space-y-3">
          {cafeteriaLoading && <Skeleton count={2} />}

          {!cafeteriaLoading && todayInfo.isWeekend && (
            <StateCard
              type="info"
              message="오늘은 주말입니다. 주말을 알차게 보내보는건 어떨까요?"
            />
          )}

          {!cafeteriaLoading && !todayInfo.isWeekend && todayMenu && (
            <Link href="/campus/cafeteria">
              <Card className="cursor-pointer hover:shadow-card-hover bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-400">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-green-700 mb-1">
                      오늘의 메뉴
                    </div>
                    <h3 className="font-semibold text-neutral-900 mb-2">
                      {todayMenu.location}
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">조식</p>
                        <p className="text-sm text-neutral-700">
                          {todayMenu.breakfast
                            .slice(0, 2)
                            .map((m) => m.name)
                            .join(", ")}{" "}
                          외
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">중식</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {todayMenu.lunch.a && (
                            <div>
                              <p className="text-xs font-medium text-green-700 mb-1">
                                A 코너
                              </p>
                              <p className="text-neutral-700">
                                {todayMenu.lunch.a
                                  .slice(0, 1)
                                  .map((m) => m.name)
                                  .join(", ")}{" "}
                                외
                              </p>
                            </div>
                          )}
                          {todayMenu.lunch.b && (
                            <div>
                              <p className="text-xs font-medium text-green-700 mb-1">
                                B 코너
                              </p>
                              <p className="text-neutral-700">
                                {todayMenu.lunch.b
                                  .slice(0, 1)
                                  .map((m) => m.name)
                                  .join(", ")}{" "}
                                외
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">석식</p>
                        <p className="text-sm text-neutral-700">
                          {todayMenu.dinner
                            .slice(0, 2)
                            .map((m) => m.name)
                            .join(", ")}{" "}
                          외
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          )}

          {!cafeteriaLoading &&
            !todayInfo.isWeekend &&
            todayInfo.dayOfWeek === 1 &&
            !todayMenu && (
              <Link href="/campus/cafeteria">
                <Card className="cursor-pointer hover:shadow-card-hover bg-gradient-to-r from-yellow-50 to-yellow-100 border-2 border-yellow-400">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-yellow-700 mb-1">
                        오늘의 메뉴
                      </div>
                      <h3 className="font-semibold text-neutral-900 mb-2">
                        식단 준비 중입니다
                      </h3>
                      <p className="text-sm text-yellow-700">
                        데이터가 준비되고 있습니다. 잠시만 기다려주세요.
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            )}
          {!cafeteriaLoading &&
            !todayInfo.isWeekend &&
            todayInfo.dayOfWeek !== 1 &&
            !todayMenu && (
              <StateCard
                type="warning"
                message="오늘 식단 정보가 없습니다. 전체 식단에서 다른 날짜를 확인해보세요."
                action={
                  <Link
                    href="/campus/cafeteria"
                    className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                  >
                    전체 식단 보기
                  </Link>
                }
              />
            )}
        </div>
      </div>

      {/* 오늘의 일정 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-neutral-900">
            오늘의 일정
          </h2>
          <Link
            href="/academic/schedule"
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            전체보기 →
          </Link>
        </div>
        <div className="space-y-4">
          {schedulesLoading && <Skeleton count={2} />}
          {!schedulesLoading && schedules && (
            <>
              {todaySchedules.length === 0 ? (
                <StateCard type="info" message="오늘 일정이 없습니다." />
              ) : (
                todaySchedules.map((schedule) => (
                    <div key={schedule.id} className="mb-3">
                      <Link href="/academic/schedule">
                        <Card className="cursor-pointer hover:shadow-card-hover">
                          <div className="flex items-center justify-between">
                            <div>
                              <Badge
                                color={
                                  schedule.category === "exam" ? "red" : "blue"
                                }
                                size="sm"
                              >
                                {getCategoryLabel(schedule.category)}
                              </Badge>
                              <h3 className="font-semibold text-neutral-900 mt-2">
                                {schedule.title}
                              </h3>
                              <p className="text-xs text-neutral-600 mt-1">
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
              )}
            </>
          )}
        </div>
      </div>

      {/* 관련 정보 퀵 링크 */}
      <div className="mt-8 pt-6 border-t border-neutral-200">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">
          더 알아보기
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Link
            href="/campus/bus-info"
            className="p-4 rounded-lg border border-neutral-200 hover:border-primary-500 hover:bg-primary-50 transition-all"
          >
            <Icon
              name="bus"
              size={24}
              color="rgb(37, 99, 235)"
              className="mb-2"
            />
            <p className="text-sm font-medium text-neutral-900">버스 정보</p>
            <p className="text-xs text-neutral-600">셔틀·시내버스</p>
          </Link>

          <Link
            href="/campus/map"
            className="p-4 rounded-lg border border-neutral-200 hover:border-primary-500 hover:bg-primary-50 transition-all"
          >
            <Icon
              name="map"
              size={24}
              color="rgb(37, 99, 235)"
              className="mb-2"
            />
            <p className="text-sm font-medium text-neutral-900">캠퍼스 지도</p>
            <p className="text-xs text-neutral-600">건물·시설</p>
          </Link>

          <Link
            href="/academic/announcements"
            className="p-4 rounded-lg border border-neutral-200 hover:border-primary-500 hover:bg-primary-50 transition-all"
          >
            <Icon
              name="megaphone"
              size={24}
              color="rgb(37, 99, 235)"
              className="mb-2"
            />
            <p className="text-sm font-medium text-neutral-900">학사공지</p>
            <p className="text-xs text-neutral-600">공지사항</p>
          </Link>

          <Link
            href="/campus/library"
            className="p-4 rounded-lg border border-neutral-200 hover:border-primary-500 hover:bg-primary-50 transition-all"
          >
            <Icon
              name="book-open"
              size={24}
              color="rgb(37, 99, 235)"
              className="mb-2"
            />
            <p className="text-sm font-medium text-neutral-900">도서관</p>
            <p className="text-xs text-neutral-600">이용정보</p>
          </Link>

          <Link
            href="/more/scholarship"
            className="p-4 rounded-lg border border-neutral-200 hover:border-primary-500 hover:bg-primary-50 transition-all"
          >
            <Icon
              name="award"
              size={24}
              color="rgb(37, 99, 235)"
              className="mb-2"
            />
            <p className="text-sm font-medium text-neutral-900">장학금</p>
            <p className="text-xs text-neutral-600">공지사항</p>
          </Link>

          <Link
            href="/more/phone"
            className="p-4 rounded-lg border border-neutral-200 hover:border-primary-500 hover:bg-primary-50 transition-all"
          >
            <Icon
              name="phone"
              size={24}
              color="rgb(37, 99, 235)"
              className="mb-2"
            />
            <p className="text-sm font-medium text-neutral-900">연락처</p>
            <p className="text-xs text-neutral-600">부서 검색</p>
          </Link>
        </div>
      </div>
    </Container>
  );
}
