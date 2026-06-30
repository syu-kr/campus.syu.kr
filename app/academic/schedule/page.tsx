import { headers } from "next/headers";

import { StructuredDataScript } from "@/app/components/StructuredDataScript";
import SchedulePageClient from "@/app/features/academic/SchedulePageClient";
import { createAcademicScheduleAnswerSummary } from "@/lib/academic-aeo";
import { getKoreaNow, getTodayInfo } from "@/lib/home";
import {
  LOCALE_HEADER_NAME,
  getDictionary,
  localizePath,
  normalizeLocale,
} from "@/lib/i18n";
import { getHomeAcademicSchedules } from "@/lib/server/home-data";
import { createFAQPageSchema } from "@/lib/structured-data";

const CSP_NONCE_HEADER_NAME = "x-csp-nonce";
const SITE_ORIGIN = "https://campus.syu.kr";

export default async function SchedulePage() {
  const headerStore = await headers();
  const locale = normalizeLocale(headerStore.get(LOCALE_HEADER_NAME));
  const nonce = headerStore.get(CSP_NONCE_HEADER_NAME) || undefined;
  const now = getKoreaNow();
  const todayInfo = getTodayInfo(now);
  const initialSchedules = await getHomeAcademicSchedules();
  const answerSummary = createAcademicScheduleAnswerSummary({
    locale,
    now,
    schedules: initialSchedules,
    todayInfo,
  });
  const dictionary = getDictionary(locale);

  return (
    <>
      <StructuredDataScript
        id="academic-schedule-answer-schema"
        nonce={nonce}
        data={createFAQPageSchema({
          inLanguage: dictionary.meta.inLanguage,
          mainEntity: [
            {
              acceptedAnswerText: answerSummary.answer,
              questionName: answerSummary.question,
            },
          ],
          url: `${SITE_ORIGIN}${localizePath("/academic/schedule", locale)}`,
        })}
      />
      <SchedulePageClient
        initialDateStringDot={todayInfo.dateStringDot}
        initialSchedules={initialSchedules}
      />
    </>
  );
}
