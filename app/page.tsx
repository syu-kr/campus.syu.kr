"use client";

import React, { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card } from "./components/Card";
import { Container } from "./components/Container";
import { SearchBar } from "./components/SearchBar";
import { Badge } from "./components/Badge";
import { AnnouncementCard } from "./components/AnnouncementCard";
import { Skeleton } from "./components/Skeleton";
import { useQuery } from "@tanstack/react-query";
import {
  fetchAnnouncements,
  fetchCafeteriaMenu,
  fetchAcademicSchedules,
  searchAll,
} from "@/lib/api";
import { formatDate, getCategoryLabel } from "@/lib/utils";
import type { Announcement } from "@/types";

// 자주 사용하는 메뉴
const frequentMenus = [
  {
    id: "1",
    icon: "📚",
    label: "모의 수강신청",
    path: "https://sugang.syu.kr/testLogin",
  },
  { id: "2", icon: "📖", label: "학사일정", path: "/academic/schedule" },
  { id: "3", icon: "🍽️", label: "학식", path: "/campus/cafeteria" },
  { id: "4", icon: "🚌", label: "셔틀버스", path: "/campus/shuttle" },
  { id: "5", icon: "🎓", label: "장학금", path: "/tuition/scholarship" },
  { id: "6", icon: "📃", label: "증명서", path: "/admin/certificate" },
];

// 공지 카테고리 필터
const categoryFilters = [
  { id: "all", label: "전체", value: undefined },
  { id: "academic", label: "학사공지", value: "academic" },
  { id: "scholarship", label: "장학금", value: "scholarship" },
  { id: "campus", label: "캠퍼스", value: "campus" },
];

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    undefined,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  // 공지사항 조회
  const { data: announcements, isLoading: announcementsLoading } = useQuery({
    queryKey: ["announcements", selectedCategory],
    queryFn: () =>
      fetchAnnouncements(
        selectedCategory as
          | "academic"
          | "campus"
          | "admin"
          | "activity"
          | undefined,
      ),
    staleTime: 5 * 60 * 1000,
  });

  // 학식 조회
  const { data: cafeteria, isLoading: cafeteriaLoading } = useQuery({
    queryKey: ["cafeteria"],
    queryFn: () => fetchCafeteriaMenu(),
    staleTime: 5 * 60 * 1000,
  });

  // 학사일정 조회
  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ["schedules"],
    queryFn: () => fetchAcademicSchedules(),
    staleTime: 5 * 60 * 1000,
  });

  // 검색
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["search", searchQuery],
    queryFn: () => searchAll(searchQuery),
    enabled: showSearchResults && searchQuery.trim().length > 0,
    staleTime: 2 * 60 * 1000,
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
  const todayInfo = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0: 일요일, 6: 토요일
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dateStringDot = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`; // YYYY.MM.DD (학사일정)
    const dateStringDash = today.toISOString().split("T")[0]; // YYYY-MM-DD (카페테리아)
    return { dateStringDot, dateStringDash, isWeekend, dayOfWeek };
  }, []);

  // 오늘 식단 찾기
  const todayMenu = useMemo(() => {
    if (!cafeteria) return null;
    return cafeteria.find((menu) => menu.date === todayInfo.dateStringDash);
  }, [cafeteria, todayInfo]);

  // 검색 결과 화면
  if (showSearchResults) {
    return (
      <Container className="py-6 sm:py-8">
        <SearchBar
          onSearch={handleSearch}
          placeholder="검색..."
          className="mb-6"
        />

        {searchLoading && (
          <div>
            <Skeleton count={3} />
          </div>
        )}

        {!searchLoading && searchResults && searchResults.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">
              검색 결과가 없습니다
            </h3>
            <p className="text-neutral-600 mb-6">다른 키워드로 검색해보세요</p>
            <button
              onClick={handleSearchClear}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              검색 취소
            </button>
          </div>
        )}

        {!searchLoading && searchResults && searchResults.length > 0 && (
          <div>
            <p className="text-sm text-neutral-600 mb-4">
              검색 결과 {searchResults.length}개
            </p>
            <div className="space-y-2">
              {searchResults.map((result) => (
                <div key={result.id} className="mb-2">
                  <AnnouncementCard
                    announcement={result as Announcement}
                    href={(result as Announcement).url}
                    external={!!(result as Announcement).url}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </Container>
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
              <span className="text-3xl mb-2">{menu.icon}</span>
              <span className="text-xs font-medium text-center text-neutral-900">
                {menu.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* 오늘의 정보 위젯 */}
      <Card className="bg-gradient-to-br from-primary-500 to-primary-600 text-white">
        <div className="space-y-4">
          <div>
            <p className="text-xs opacity-90 mb-1">오늘의 일정</p>
            <h3 className="text-lg font-semibold">학사일정을 확인하세요</h3>
          </div>
          <Link href="/academic/schedule" className="inline-block">
            <button className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-all text-sm font-medium">
              전체 일정 보기 →
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
                ? "/tuition/scholarship"
                : selectedCategory === "campus"
                  ? "/campus/announcements"
                  : "/academic/announcements"
            }
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            전체보기 →
          </Link>
        </div>

        {/* 카테고리 필터 */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
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
        <div className="space-y-2">
          {announcementsLoading && <Skeleton count={3} />}
          {!announcementsLoading &&
            announcements &&
            announcements.slice(0, 3).map((announcement) => (
              <div key={announcement.id} className="mb-2">
                <AnnouncementCard
                  announcement={announcement}
                  href={announcement.url}
                  external={true}
                />
              </div>
            ))}
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
            <Card className="bg-neutral-100">
              <div className="text-center py-4">
                <p className="text-sm text-neutral-600">
                  주말입니다. 카페테리아는 운영하지 않습니다.
                </p>
              </div>
            </Card>
          )}

          {!cafeteriaLoading && !todayInfo.isWeekend && todayMenu && (
            <Link href="/campus/cafeteria">
              <Card className="cursor-pointer hover:shadow-card-hover bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-400">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-green-700 mb-1">
                      🌟 오늘의 메뉴
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
                  <span className="text-2xl">🍽️</span>
                </div>
              </Card>
            </Link>
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
        <div className="space-y-2">
          {schedulesLoading && <Skeleton count={2} />}
          {!schedulesLoading && schedules && (
            <>
              {schedules.filter((schedule) => {
                const isToday =
                  schedule.startDate === todayInfo.dateStringDot ||
                  (todayInfo.dateStringDot >= schedule.startDate &&
                    todayInfo.dateStringDot <= schedule.endDate);
                return isToday;
              }).length === 0 ? (
                <div className="py-4 text-center text-neutral-600 text-sm">
                  오늘 일정이 없습니다.
                </div>
              ) : (
                schedules
                  .filter((schedule) => {
                    const isToday =
                      schedule.startDate === todayInfo.dateStringDot ||
                      (todayInfo.dateStringDot >= schedule.startDate &&
                        todayInfo.dateStringDot <= schedule.endDate);
                    return isToday;
                  })
                  .map((schedule) => (
                    <Link key={schedule.id} href="/academic/schedule">
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
                          <span className="text-2xl">
                            {schedule.category === "exam" ? "📝" : "📅"}
                          </span>
                        </div>
                      </Card>
                    </Link>
                  ))
              )}
            </>
          )}
        </div>
      </div>
    </Container>
  );
}
