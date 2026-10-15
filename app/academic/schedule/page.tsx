import SchedulePageClient from "@/app/features/academic/SchedulePageClient";
import { getKoreaNow, getTodayInfo } from "@/lib/home";
import {
  getHomeAcademicSchedules,
  getHomePublicHolidays,
} from "@/lib/server/home-data";

export default async function SchedulePage() {
  const [initialSchedules, initialPublicHolidays] = await Promise.all([
    getHomeAcademicSchedules(),
    getHomePublicHolidays(),
  ]);
  const now = getKoreaNow();
  const todayInfo = getTodayInfo(now);
  return (
    <SchedulePageClient
      initialDateStringDot={todayInfo.dateStringDot}
      initialNowIso={now.toISOString()}
      initialSchedules={initialSchedules}
      initialPublicHolidays={initialPublicHolidays}
    />
  );
}
