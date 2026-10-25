import { Activity, Suspense } from "react";
import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";

import { HomePageSkeleton } from "@/app/components/PageLoadingSkeletons";
import { HomeDashboardClient } from "@/app/features/home/HomeDashboardClient";
import { HomeSearchBar } from "@/app/features/home/HomeSearchBar";
import { getAnnouncementSummary } from "@/lib/server/announcements";
import {
  getHomeAcademicSchedules,
  getHomeCafeteriaSnapshot,
  getHomeShuttleBuses,
  getHomeShuttleSpecialPeriods,
  getHomePublicHolidays,
} from "@/lib/server/home-data";
import { getKoreaNow } from "@/lib/home";
import { getAllServiceNotices } from "@/lib/serviceNotices";

export const revalidate = 300;

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const params = await searchParams;
  const search = Array.isArray(params.search) ? params.search[0] : params.search;
  return search?.trim() ? { robots: { index: false, follow: true } } : {};
}

// This boolean only hints the rendering path; it stores no data or freshness state.
let hasResolvedHomeData = false;

function markHomeDataResolved() {
  hasResolvedHomeData = true;
}

export default function Home() {
  return (
    <>
      <HomeSearchBar />
      {hasResolvedHomeData ? <WarmHomeContent /> : (
        <Suspense fallback={<HomePageSkeleton />}>
          <HomeContent />
        </Suspense>
      )}
    </>
  );
}

async function WarmHomeContent() {
  const content = HomeContent();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Give warm data 20 ms to avoid a streamed reveal without waiting on cold data.
    const ready = await Promise.race([
      content,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 20);
      }),
    ]);
    if (ready) return ready;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <DeferredHomeContent content={content} />
    </Suspense>
  );
}

async function DeferredHomeContent({ content }: { content: ReturnType<typeof HomeContent> }) {
  return content;
}

async function HomeContent() {
  const [
    initialAnnouncements,
    initialServiceNotices,
    initialSchedules,
    initialPublicHolidays,
    initialCafeteria,
    initialShuttles,
    initialSpecialPeriods,
  ] = await Promise.all([
      getAnnouncementSummary(12),
      getAllServiceNotices(),
      getHomeAcademicSchedules(),
      getHomePublicHolidays(),
      getOptionalCafeteriaSnapshot(),
      getHomeShuttleBuses(),
      getHomeShuttleSpecialPeriods(),
    ]);

  markHomeDataResolved();

  // Keep ready HTML visible while hydrating the dashboard independently from search.
  return (
    <Activity mode="visible">
      <HomeDashboardClient
        initialAnnouncements={initialAnnouncements}
        initialServiceNotices={initialServiceNotices}
        initialSchedules={initialSchedules}
        initialPublicHolidays={initialPublicHolidays}
        initialOverviewData={{ cafeteria: initialCafeteria, shuttles: initialShuttles, specialPeriods: initialSpecialPeriods }}
        initialNowIso={getKoreaNow().toISOString()}
      />
    </Activity>
  );
}

async function getOptionalCafeteriaSnapshot() {
  try {
    return await getHomeCafeteriaSnapshot();
  } catch (error) {
    unstable_rethrow(error);
    return undefined;
  }
}
