import { headers } from "next/headers";

import { StructuredDataScript } from "@/app/components/StructuredDataScript";
import { CafeteriaPageClient } from "@/app/features/cafeteria/CafeteriaPageClient";
import { createCafeteriaAnswerSummary } from "@/lib/campus-aeo";
import { getKoreaNow, getTodayInfo } from "@/lib/home";
import {
  LOCALE_HEADER_NAME,
  getDictionary,
  localizePath,
  normalizeLocale,
} from "@/lib/i18n";
import { getHomeCafeteriaMenus } from "@/lib/server/home-data";
import { createFAQPageSchema } from "@/lib/structured-data";

const CSP_NONCE_HEADER_NAME = "x-csp-nonce";
const SITE_ORIGIN = "https://campus.syu.kr";

export default async function CafeteriaPage() {
  const headerStore = await headers();
  const locale = normalizeLocale(headerStore.get(LOCALE_HEADER_NAME));
  const nonce = headerStore.get(CSP_NONCE_HEADER_NAME) || undefined;
  const now = getKoreaNow();
  const todayInfo = getTodayInfo(now);
  const initialMenus = await getHomeCafeteriaMenus();
  const answerSummary = createCafeteriaAnswerSummary({
    locale,
    menus: initialMenus,
    now,
    todayInfo,
  });
  const dictionary = getDictionary(locale);

  return (
    <>
      <StructuredDataScript
        id="cafeteria-answer-schema"
        nonce={nonce}
        data={createFAQPageSchema({
          inLanguage: dictionary.meta.inLanguage,
          mainEntity: [
            {
              acceptedAnswerText: answerSummary.answer,
              questionName: answerSummary.question,
            },
          ],
          url: `${SITE_ORIGIN}${localizePath("/campus/cafeteria", locale)}`,
        })}
      />
      <CafeteriaPageClient
        initialMenus={initialMenus}
        initialNowIso={now.toISOString()}
      />
    </>
  );
}
