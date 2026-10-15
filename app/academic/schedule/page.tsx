import { headers } from "next/headers";

import SchedulePageClient from "@/app/features/academic/SchedulePageClient";
import { getKoreaNow, getTodayInfo } from "@/lib/home";
import {
  getHomeAcademicSchedules,
  getHomePublicHolidays,
} from "@/lib/server/home-data";

const CSP_NONCE_HEADER_NAME = "x-csp-nonce";

export default async function SchedulePage() {
  const headerStore = await headers();
  const nonce = headerStore.get(CSP_NONCE_HEADER_NAME) || undefined;
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
      nonce={nonce}
    />
  );
}
