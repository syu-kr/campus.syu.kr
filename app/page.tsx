import { HomePageClient } from "@/app/features/home/HomePageClient";
import { getAnnouncementSummary } from "@/lib/server/announcements";
import {
  getHomeAcademicSchedules,
  getHomeCafeteriaMenus,
} from "@/lib/server/home-data";
import { getKoreaNow } from "@/lib/home";
import { getAllServiceNotices } from "@/lib/serviceNotices";

export const revalidate = 300;

export default async function Home() {
  const [initialAnnouncements, initialServiceNotices, initialCafeteria, initialSchedules] =
    await Promise.all([
      getAnnouncementSummary(12),
      getAllServiceNotices(),
      getHomeCafeteriaMenus(),
      getHomeAcademicSchedules(),
    ]);

  return (
    <HomePageClient
      initialAnnouncements={initialAnnouncements}
      initialServiceNotices={initialServiceNotices}
      initialCafeteria={initialCafeteria}
      initialSchedules={initialSchedules}
      initialNowIso={getKoreaNow().toISOString()}
    />
  );
}
