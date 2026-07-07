"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { Container } from "@/app/components/Container";
import { SearchBar } from "@/app/components/SearchBar";
import {
  fetchAnnouncementSummary,
  fetchAnnouncements,
  fetchCafeteriaMenu,
  fetchAcademicSchedules,
  fetchShuttleBuses,
  fetchShuttleSpecialPeriods,
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
import { isCafeteriaMenuDataStale } from "@/lib/cafeteria";
import type {
  AcademicSchedule,
  Announcement,
  CafeteriaMenu,
  HomeNoticeCategory,
  ServiceNotice,
  ShuttleBusSchedule,
  ShuttleSpecialPeriods,
} from "@/types";
import { SearchResultsView } from "@/app/features/home/SearchResultsView";
import {
  FrequentMenuGrid,
  PwaInstallCard,
  RelatedLinksSection,
} from "@/app/features/home/HomeMenuSections";
import {
  HomeNoticesSection,
  TodayShuttleSection,
  TodayMenuSection,
  TodaySchedulesSection,
} from "@/app/features/home/HomeDashboardSections";
import { useLocale } from "@/app/components/LocaleProvider";

const ONE_MINUTE = 60 * 1000;
const FIVE_MINUTES = 5 * ONE_MINUTE;
const TEN_MINUTES = 10 * ONE_MINUTE;
const THIRTY_MINUTES = 30 * ONE_MINUTE;
const ONE_HOUR = 60 * ONE_MINUTE;

interface HomePageClientProps {
  initialAnnouncements: Announcement[];
  initialServiceNotices: ServiceNotice[];
  initialCafeteria: CafeteriaMenu[];
  initialSchedules: AcademicSchedule[];
  initialShuttleBuses: ShuttleBusSchedule[];
  initialShuttleSpecialPeriods: ShuttleSpecialPeriods;
  initialNowIso: string;
}

export function HomePageClient({
  initialAnnouncements,
  initialServiceNotices,
  initialCafeteria,
  initialSchedules,
  initialShuttleBuses,
  initialShuttleSpecialPeriods,
  initialNowIso,
}: HomePageClientProps) {
  const locale = useLocale();
  const [selectedCategory, setSelectedCategory] = useState<
    HomeNoticeCategory | undefined
  >(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [now, setNow] = useState<Date | null>(() => new Date(initialNowIso));

  useEffect(() => {
    setNow(getKoreaNow());

    const timer = setInterval(() => {
      setNow(getKoreaNow());
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: announcements, isLoading: announcementsLoading } = useQuery({
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

  const { data: serviceNotices, isLoading: serviceNoticesLoading } = useQuery({
    queryKey: ["serviceNotices"],
    queryFn: () =>
      fetchJson<ServiceNotice[]>("/api/service-notices", { fallback: [] }),
    initialData: initialServiceNotices,
    staleTime: FIVE_MINUTES,
    gcTime: TEN_MINUTES,
  });

  const { data: cafeteria, isLoading: cafeteriaLoading } = useQuery({
    queryKey: ["cafeteria"],
    queryFn: () => fetchCafeteriaMenu(),
    initialData: initialCafeteria,
    staleTime: FIVE_MINUTES,
    gcTime: TEN_MINUTES,
  });

  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ["schedules"],
    queryFn: () => fetchAcademicSchedules(),
    initialData: initialSchedules,
    staleTime: THIRTY_MINUTES,
    gcTime: ONE_HOUR,
  });

  const { data: shuttleBuses, isLoading: shuttleBusesLoading } = useQuery({
    queryKey: ["shuttle-buses"],
    queryFn: () => fetchShuttleBuses(),
    initialData: initialShuttleBuses,
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
  });

  const {
    data: shuttleSpecialPeriods,
    isLoading: shuttleSpecialPeriodsLoading,
  } = useQuery({
    queryKey: ["shuttle-special-periods"],
    queryFn: () => fetchShuttleSpecialPeriods(),
    initialData: initialShuttleSpecialPeriods,
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
  });

  const {
    data: searchResults,
    isLoading: searchLoading,
    isError: searchError,
    refetch: refetchSearch,
  } = useQuery({
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

  const todayInfo = useMemo(() => getTodayInfo(now), [now]);
  const hasStaleCafeteriaData = useMemo(
    () => isCafeteriaMenuDataStale(cafeteria, todayInfo.dateStringDash),
    [cafeteria, todayInfo.dateStringDash],
  );

  const todayMenu = useMemo(() => {
    if (!cafeteria || hasStaleCafeteriaData) return null;
    return cafeteria.find((menu) => menu.date === todayInfo.dateStringDash);
  }, [cafeteria, hasStaleCafeteriaData, todayInfo.dateStringDash]);

  const todaySchedules = useMemo(() => {
    if (!schedules) return [];
    return schedules.filter((schedule) =>
      isScheduleOnDate(schedule, todayInfo.dateStringDot),
    );
  }, [schedules, todayInfo.dateStringDot]);

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
      <SearchBar onSearch={handleSearch} className="mt-2" />

      <TodayMenuSection
        isLoading={cafeteriaLoading}
        todayInfo={todayInfo}
        todayMenu={todayMenu ?? null}
        hasStaleMenuData={hasStaleCafeteriaData}
      />
      <TodayShuttleSection
        isLoading={shuttleBusesLoading || shuttleSpecialPeriodsLoading}
        buses={shuttleBuses}
        specialPeriods={shuttleSpecialPeriods}
        now={now}
      />
      <HomeNoticesSection
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        serviceNotices={serviceNotices}
        serviceNoticesLoading={serviceNoticesLoading}
        announcementsLoading={announcementsLoading}
        homeNotices={homeNotices}
      />
      <TodaySchedulesSection
        isLoading={schedulesLoading}
        schedules={todaySchedules}
      />

      <FrequentMenuGrid />
      <RelatedLinksSection />
      <PwaInstallCard />
    </Container>
  );
}
