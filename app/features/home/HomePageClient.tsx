"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Container } from "@/app/components/Container";
import { SearchBar } from "@/app/components/SearchBar";
import {
  fetchAnnouncementSummary,
  fetchAnnouncements,
  fetchAcademicSchedules,
  fetchPublicHolidays,
  searchAll,
} from "@/lib/api";
import { fetchJson } from "@/lib/fetch-json";
import { mergePublicHolidays } from "@/lib/public-holidays";
import {
  categorizeSearchResults,
  getKoreaNow,
  getHomeNotices,
  getTodayInfo,
  isFestivalPromotionVisible,
  isScheduleOnDate,
} from "@/lib/home";
import type {
  AcademicSchedule,
  Announcement,
  HomeNoticeCategory,
  ServiceNotice,
  PublicHolidaySnapshot,
} from "@/types";
import { SearchResultsView } from "@/app/features/home/SearchResultsView";
import {
  FrequentMenuGrid,
  PwaInstallCard,
  RelatedLinksSection,
} from "@/app/features/home/HomeMenuSections";
import {
  HomeNoticesSection,
  TodaySchedulesSection,
} from "@/app/features/home/HomeDashboardSections";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";

const ONE_MINUTE = 60 * 1000;
const FIVE_MINUTES = 5 * ONE_MINUTE;
const TEN_MINUTES = 10 * ONE_MINUTE;
const THIRTY_MINUTES = 30 * ONE_MINUTE;
const ONE_HOUR = 60 * ONE_MINUTE;

interface HomePageClientProps {
  initialAnnouncements: Announcement[];
  initialServiceNotices: ServiceNotice[];
  initialSchedules: AcademicSchedule[];
  initialPublicHolidays?: PublicHolidaySnapshot;
  initialNowIso: string;
}

export function HomePageClient({
  initialAnnouncements,
  initialServiceNotices,
  initialSchedules,
  initialPublicHolidays,
  initialNowIso,
}: HomePageClientProps) {
  const locale = useLocale();
  const dictionary = useDictionary();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState<
    HomeNoticeCategory | undefined
  >(undefined);
  const searchQuery = searchParams.get("search")?.trim() ?? "";
  const showSearchResults = Boolean(searchQuery);
  const [now, setNow] = useState<Date | null>(() => new Date(initialNowIso));

  useEffect(() => {
    setNow(getKoreaNow());

    const timer = setInterval(() => {
      setNow(getKoreaNow());
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const {
    data: announcements,
    isLoading: announcementsLoading,
    isError: announcementsError,
    refetch: refetchAnnouncements,
  } = useQuery({
    queryKey: ["announcements", selectedCategory],
    queryFn: () =>
      selectedCategory && selectedCategory !== "service"
        ? fetchAnnouncements(selectedCategory)
        : fetchAnnouncementSummary(),
    initialData: selectedCategory ? undefined : initialAnnouncements,
    enabled: selectedCategory !== "service",
    staleTime: ONE_MINUTE,
    gcTime: FIVE_MINUTES,
  });

  const {
    data: serviceNotices,
    isLoading: serviceNoticesLoading,
    isError: serviceNoticesError,
    refetch: refetchServiceNotices,
  } = useQuery({
    queryKey: ["serviceNotices"],
    queryFn: () =>
      fetchJson<ServiceNotice[]>("/api/service-notices", {
        fallback: [],
        throwOnError: true,
      }),
    initialData: initialServiceNotices,
    staleTime: FIVE_MINUTES,
    gcTime: TEN_MINUTES,
  });

  const {
    data: schedules,
    isLoading: schedulesLoading,
    isError: schedulesError,
    refetch: refetchSchedules,
  } = useQuery({
    queryKey: ["schedules"],
    queryFn: () => fetchAcademicSchedules(),
    initialData: initialSchedules,
    staleTime: THIRTY_MINUTES,
    gcTime: ONE_HOUR,
  });

  const { data: publicHolidays, isError: holidaysError, refetch: refetchHolidays } = useQuery({
    queryKey: ["public-holidays"], queryFn: fetchPublicHolidays,
    initialData: initialPublicHolidays, staleTime: FIVE_MINUTES,
    refetchInterval: FIVE_MINUTES,
  });
  const effectiveHolidays = useMemo(() => publicHolidays && {
    ...publicHolidays, stale: publicHolidays.stale || holidaysError,
  }, [publicHolidays, holidaysError]);

  const {
    data: searchData,
    isLoading: searchLoading,
    isError: searchError,
    refetch: refetchSearch,
  } = useQuery({
    queryKey: ["search", searchQuery],
    queryFn: ({ signal }) => searchAll(searchQuery, signal),
    enabled: showSearchResults && searchQuery.trim().length > 0,
    staleTime: FIVE_MINUTES,
    gcTime: TEN_MINUTES,
  });
  const searchResults = searchData?.items;

  const handleSearch = useCallback((query: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const normalized = query.trim();
    if (normalized) params.set("search", normalized);
    else params.delete("search");
    router.push(`${pathname}${params.size ? `?${params}` : ""}`);
  }, [pathname, router, searchParams]);

  const handleSearchClear = useCallback(() => {
    handleSearch("");
  }, [handleSearch]);

  const todayInfo = useMemo(() => getTodayInfo(now), [now]);
  const todaySchedules = useMemo(() => {
    return mergePublicHolidays(schedules ?? [], effectiveHolidays).filter((schedule) =>
      isScheduleOnDate(schedule, todayInfo.dateStringDot),
    );
  }, [schedules, effectiveHolidays, todayInfo.dateStringDot]);

  const categorizedResults = useMemo(() => {
    return categorizeSearchResults(
      showSearchResults ? searchResults : undefined,
      locale,
    );
  }, [locale, showSearchResults, searchResults]);

  const homeNotices = useMemo(
    () => getHomeNotices(announcements, serviceNotices, selectedCategory),
    [announcements, serviceNotices, selectedCategory],
  );

  if (showSearchResults) {
    return (
      <SearchResultsView
        searchQuery={searchQuery}
        searchResults={searchResults}
        failedSources={searchData?.failedSources ?? []}
        categorizedResults={categorizedResults}
        isLoading={searchLoading}
        isError={searchError}
        onSearch={handleSearch}
        onClear={handleSearchClear}
        onRetry={() => refetchSearch()}
      />
    );
  }

  return (
    <Container className="py-5 sm:py-8 space-y-6">
      <h1 className="sr-only">SYU CAMPUS</h1>
      <SearchBar onSearch={handleSearch} className="mt-2" />
      <FrequentMenuGrid />

      {isFestivalPromotionVisible(todayInfo.dateStringDash) && (
        <a
          href="https://festa.syu-likelion.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-card border border-primary-200 bg-primary-50 p-4 transition-colors hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
          <h2 className="text-sm font-semibold text-neutral-900">
            {dictionary.home.festival.title}
          </h2>
          <p className="mt-1 text-sm text-primary-700">
            {dictionary.home.festival.action} ↗
          </p>
        </a>
      )}

      <HomeNoticesSection
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        serviceNotices={serviceNotices}
        serviceNoticesLoading={serviceNoticesLoading}
        announcementsLoading={announcementsLoading}
        hasError={
          selectedCategory === "service"
            ? serviceNoticesError
            : announcementsError || serviceNoticesError
        }
        onRetry={() => {
          if (selectedCategory === "service") {
            void refetchServiceNotices();
            return;
          }
          void refetchAnnouncements();
          void refetchServiceNotices();
        }}
        homeNotices={homeNotices}
      />
      <TodaySchedulesSection
        isLoading={schedulesLoading}
        isError={schedulesError}
        onRetry={() => { void refetchSchedules(); void refetchHolidays(); }}
        schedules={todaySchedules}
      />

      <RelatedLinksSection />
      <PwaInstallCard />
    </Container>
  );
}
