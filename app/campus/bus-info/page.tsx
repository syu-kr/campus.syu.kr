import { headers } from "next/headers";

import { StructuredDataScript } from "@/app/components/StructuredDataScript";
import BusInfoPageClient from "@/app/campus/bus-info/BusInfoPageClient";
import { createShuttleAnswerSummary } from "@/lib/campus-aeo";
import { getKoreaNow } from "@/lib/home";
import {
  LOCALE_HEADER_NAME,
  getDictionary,
  localizePath,
  normalizeLocale,
} from "@/lib/i18n";
import {
  getHomeShuttleBuses,
  getHomeShuttleSpecialPeriods,
} from "@/lib/server/home-data";
import { getCurrentShuttleSummary } from "@/lib/shuttle-schedule";
import { createFAQPageSchema } from "@/lib/structured-data";

const CSP_NONCE_HEADER_NAME = "x-csp-nonce";
const SITE_ORIGIN = "https://campus.syu.kr";

export default async function BusInfoPage() {
  const headerStore = await headers();
  const locale = normalizeLocale(headerStore.get(LOCALE_HEADER_NAME));
  const nonce = headerStore.get(CSP_NONCE_HEADER_NAME) || undefined;
  const now = getKoreaNow();
  const [shuttleBuses, shuttleSpecialPeriods] = await Promise.all([
    getHomeShuttleBuses(),
    getHomeShuttleSpecialPeriods(),
  ]);
  const shuttleSummary = getCurrentShuttleSummary({
    buses: shuttleBuses,
    specialPeriods: shuttleSpecialPeriods,
    now,
    limit: 3,
  });
  const answerSummary = createShuttleAnswerSummary({
    locale,
    now,
    summary: shuttleSummary,
  });
  const dictionary = getDictionary(locale);

  return (
    <>
      <StructuredDataScript
        id="shuttle-answer-schema"
        nonce={nonce}
        data={createFAQPageSchema({
          inLanguage: dictionary.meta.inLanguage,
          mainEntity: [
            {
              acceptedAnswerText: answerSummary.answer,
              questionName: answerSummary.question,
            },
          ],
          url: `${SITE_ORIGIN}${localizePath("/campus/bus-info", locale)}`,
        })}
      />
      <BusInfoPageClient shuttleAnswerSummary={answerSummary} />
    </>
  );
}
