"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { Container } from "@/app/components/Container";
import { useHomeSearch } from "./HomeSearchBar";
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
import { M3HomeOverview, type HomeOverviewData } from "./M3HomeOverview";
import { ManagedBanners } from "@/app/components/ManagedBanners";
import type { PublicBanner } from "@/types/managed-content";

const ONE_MINUTE = 60 * 1000;
const FIVE_MINUTES = 5 * ONE_MINUTE;
const TEN_MINUTES = 10 * ONE_MINUTE;
const THIRTY_MINUTES = 30 * ONE_MINUTE;
const ONE_HOUR = 60 * ONE_MINUTE;

interface HomePageClientProps {
  initialAnnouncements: Announcement[];
  initialServiceNotices: ServiceNotice[];
  initialServiceNoticesFailed?: boolean;
  initialBanners?: PublicBanner[];
  initialSchedules: AcademicSchedule[];
  initialPublicHolidays?: PublicHolidaySnapshot;
  initialNowIso: string;
  initialOverviewData?: Omit<HomeOverviewData, "updatedAt" | "holidays">;
}

export function HomePageClient({
  initialAnnouncements,
  initialServiceNotices,
  initialServiceNoticesFailed = false,
  initialBanners = [],
  initialSchedules,
  initialPublicHolidays,
  initialNowIso,
  initialOverviewData,
}: HomePageClientProps) {
  const locale = useLocale();
  const dictionary = useDictionary();
  const { searchQuery, handleSearch, handleSearchClear } = useHomeSearch();
  const [selectedCategory, setSelectedCategory] = useState<
    HomeNoticeCategory | undefined
  >(undefined);
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
    isFetchedAfterMount: serviceNoticesFetched,
    refetch: refetchServiceNotices,
  } = useQuery({
    queryKey: ["serviceNotices", locale],
    queryFn: () =>
      fetchJson<ServiceNotice[]>(`/api/service-notices?locale=${locale}`, {
        fallback: [],
        throwOnError: true,
      }),
    initialData: initialServiceNotices,
    initialDataUpdatedAt: initialServiceNoticesFailed ? 0 : undefined,
    staleTime: 30_000,
    refetchInterval: 30_000,
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

  const todayInfo = useMemo(() => getTodayInfo(now), [now]);
  const todaySchedules = useMemo(() => {
    return mergePublicHolidays(schedules ?? [], effectiveHolidays).filter((schedule) =>
      isScheduleOnDate(schedule, todayInfo.dateStringDot),
    );
  }, [schedules, effectiveHolidays, todayInfo.dateStringDot]);

  const categorizedResults = useMemo(() => {
    return categorizeSearchResults(
      showSearchResults ? searchResults : undefined,
      dictionary.categories,
      locale,
    );
  }, [dictionary.categories, locale, showSearchResults, searchResults]);

  const homeNotices = useMemo(
    () => getHomeNotices(announcements, serviceNotices.filter(notice => (!notice.startsAt || Date.parse(notice.startsAt) <= (now?.getTime() ?? 0)) && (!notice.endsAt || (now?.getTime() ?? 0) < Date.parse(notice.endsAt))), selectedCategory),
    [announcements, serviceNotices, selectedCategory, now],
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
    <Container className="m3-home-content space-y-6 pb-5 pt-6 sm:pb-8">
      <M3HomeOverview now={now}
        banner={<ManagedBanners initialBanners={initialBanners} placement="home" initialNow={Date.parse(initialNowIso)} />}
        initial={{ ...initialOverviewData, holidays: initialPublicHolidays, updatedAt: Date.parse(initialNowIso) }}>
        <TodaySchedulesSection isLoading={schedulesLoading} isError={schedulesError}
          onRetry={() => { void refetchSchedules(); void refetchHolidays(); }} schedules={todaySchedules} />
      </M3HomeOverview>
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
            ? serviceNoticesError || (initialServiceNoticesFailed && !serviceNoticesFetched)
            : announcementsError || serviceNoticesError || (initialServiceNoticesFailed && !serviceNoticesFetched)
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

      <RelatedLinksSection />
      <PwaInstallCard />
    </Container>
  );
}
