import { headers } from "next/headers";

import { StructuredDataScript } from "@/app/components/StructuredDataScript";
import GraduationPageClient from "@/app/features/academic/GraduationPageClient";
import { createGraduationAnswerSummary } from "@/lib/academic-aeo";
import { getGraduationMetadata } from "@/lib/graduation";
import { getKoreaNow } from "@/lib/home";
import {
  LOCALE_HEADER_NAME,
  getDictionary,
  localizePath,
  normalizeLocale,
} from "@/lib/i18n";
import { createFAQPageSchema } from "@/lib/structured-data";

const CSP_NONCE_HEADER_NAME = "x-csp-nonce";
const SITE_ORIGIN = "https://campus.syu.kr";

export default async function GraduationPage() {
  const headerStore = await headers();
  const locale = normalizeLocale(headerStore.get(LOCALE_HEADER_NAME));
  const nonce = headerStore.get(CSP_NONCE_HEADER_NAME) || undefined;
  const now = getKoreaNow();
  const metadata = getGraduationMetadata();
  const answerSummary = createGraduationAnswerSummary({
    locale,
    metadata,
    now,
  });
  const dictionary = getDictionary(locale);

  return (
    <>
      <StructuredDataScript
        id="graduation-answer-schema"
        nonce={nonce}
        data={createFAQPageSchema({
          inLanguage: dictionary.meta.inLanguage,
          mainEntity: [
            {
              acceptedAnswerText: answerSummary.answer,
              questionName: answerSummary.question,
            },
          ],
          url: `${SITE_ORIGIN}${localizePath("/academic/graduation", locale)}`,
        })}
      />
      <GraduationPageClient answerSummary={answerSummary} />
    </>
  );
}
