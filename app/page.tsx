"use client";

import React, { useState, useCallback } from "react";
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
import { formatDate, getCategoryColor, getCategoryLabel } from "@/lib/utils";

// 자주 사용하는 메뉴
const frequentMenus = [
  { id: "1", icon: "📚", label: "수강신청", path: "/academic/registration" },
  { id: "2", icon: "📖", label: "학사일정", path: "/academic/schedule" },
  { id: "3", icon: "🍽️", label: "학식", path: "/campus/cafeteria" },
  { id: "4", icon: "🚌", label: "셔틀버스", path: "/campus/shuttle" },
  { id: "5", icon: "🎓", label: "장학금", path: "/tuition/scholarship" },
  { id: "6", icon: "📃", label: "증명서", path: "/admin/certificate" },
];

// 공지 카테고리 필터
const categoryFilters = [
  { id: "all", label: "전체", value: undefined },
  { id: "academic", label: "학사", value: "academic" },
  { id: "campus", label: "캠퍼스", value: "campus" },
  { id: "admin", label: "행정", value: "admin" },
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
    queryFn: () => fetchAnnouncements(selectedCategory as any),
    staleTime: 5 * 60 * 1000,
  });

  // 학식 조회
  const { data: cafeteria, isLoading: cafeteriaLoading } = useQuery({
    queryKey: ["cafeteria"],
    queryFn: fetchCafeteriaMenu,
    staleTime: 5 * 60 * 1000,
  });

  // 학사일정 조회
  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ["schedules"],
    queryFn: () => fetchAcademicSchedules("exam"),
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
            <div className="space-y-3">
              {searchResults.map((result) => (
                <AnnouncementCard
                  key={result.id}
                  announcement={result as any}
                  href={`/announcements/${result.id}`}
                />
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
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-neutral-900">공지사항</h2>
          <Link
            href="/announcements"
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
        <div className="space-y-3">
          {announcementsLoading && <Skeleton count={3} />}
          {!announcementsLoading &&
            announcements &&
            announcements
              .slice(0, 3)
              .map((announcement) => (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  href={`/announcements/${announcement.id}`}
                />
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
          {!cafeteriaLoading && cafeteria && cafeteria[0] && (
            <Link href="/campus/cafeteria">
              <Card className="cursor-pointer hover:shadow-card-hover">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm text-neutral-600 mb-1">
                      {cafeteria[0].dayOfWeek}요일
                    </div>
                    <h3 className="font-semibold text-neutral-900 mb-2">
                      {cafeteria[0].location}
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">조식</p>
                        <p className="text-sm text-neutral-700">
                          {cafeteria[0].breakfast
                            .slice(0, 2)
                            .map((m) => m.name)
                            .join(", ")}{" "}
                          외
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">중식</p>
                        <p className="text-sm text-neutral-700">
                          {cafeteria[0].lunch
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

      {/* 시험 일정 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-neutral-900">시험 일정</h2>
          <Link
            href="/academic/schedule"
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            전체보기 →
          </Link>
        </div>
        <div className="space-y-2">
          {schedulesLoading && <Skeleton count={2} />}
          {!schedulesLoading &&
            schedules &&
            schedules.slice(0, 2).map((schedule) => (
              <Link key={schedule.id} href="/academic/schedule">
                <Card className="cursor-pointer hover:shadow-card-hover">
                  <div className="flex items-center justify-between">
                    <div>
                      <Badge
                        color={schedule.category === "exam" ? "red" : "blue"}
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
                    <span className="text-2xl">📅</span>
                  </div>
                </Card>
              </Link>
            ))}
        </div>
      </div>
    </Container>
  );
}
