import { HomePageClient } from "@/app/features/home/HomePageClient";
import { getAnnouncementSummary } from "@/lib/server/announcements";
import {
  getHomeAcademicSchedules,
  getHomeCafeteriaMenus,
  getHomeShuttleBuses,
  getHomeShuttleSpecialPeriods,
} from "@/lib/server/home-data";
import { getKoreaNow } from "@/lib/home";
import { getAllServiceNotices } from "@/lib/serviceNotices";

export const revalidate = 300;

export default async function Home() {
  const [
    initialAnnouncements,
    initialServiceNotices,
    initialCafeteria,
    initialSchedules,
    initialShuttleBuses,
    initialShuttleSpecialPeriods,
  ] = await Promise.all([
      getAnnouncementSummary(12),
      getAllServiceNotices(),
      getHomeCafeteriaMenus(),
      getHomeAcademicSchedules(),
      getHomeShuttleBuses(),
      getHomeShuttleSpecialPeriods(),
    ]);

  return (
    <HomePageClient
      initialAnnouncements={initialAnnouncements}
      initialServiceNotices={initialServiceNotices}
      initialCafeteria={initialCafeteria}
      initialSchedules={initialSchedules}
      initialShuttleBuses={initialShuttleBuses}
      initialShuttleSpecialPeriods={initialShuttleSpecialPeriods}
      initialNowIso={getKoreaNow().toISOString()}
    />
  );
}
