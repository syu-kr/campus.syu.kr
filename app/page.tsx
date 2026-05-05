"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";

import { Container } from "./components/Container";
import { SearchBar } from "./components/SearchBar";
import { useQuery } from "@tanstack/react-query";
import {
  fetchAnnouncementSummary,
  fetchAnnouncements,
  fetchCafeteriaMenu,
  fetchAcademicSchedules,
  searchAll,
} from "@/lib/api";
import { fetchJson } from "@/lib/fetch-json";
import {
  categorizeSearchResults,
  getKoreaNow,
  getHomeNotices,
  getTodayInfo,
  isScheduleOnDate,
} from "@/lib/home";
import type { ServiceNotice } from "@/types";
import { SearchResultsView } from "@/app/features/home/SearchResultsView";
import {
  FrequentMenuGrid,
  PwaInstallCard,
  RelatedLinksSection,
} from "@/app/features/home/HomeMenuSections";
import {
  HomeNoticesSection,
  TodayMenuSection,
  TodaySchedulesSection,
} from "@/app/features/home/HomeDashboardSections";

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
      <SearchBar onSearch={handleSearch} className="mt-4" />

      <FrequentMenuGrid />
      <PwaInstallCard />

      <HomeNoticesSection
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        serviceNotices={serviceNotices}
        serviceNoticesLoading={serviceNoticesLoading}
        announcementsLoading={announcementsLoading}
        homeNotices={homeNotices}
      />
      <TodayMenuSection
        isLoading={cafeteriaLoading}
        todayInfo={todayInfo}
        todayMenu={todayMenu ?? null}
      />
      <TodaySchedulesSection
        isLoading={schedulesLoading}
        schedules={todaySchedules}
      />

      <RelatedLinksSection />
    </Container>
  );
}
