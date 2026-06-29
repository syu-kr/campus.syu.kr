import { headers } from "next/headers";

import { StructuredDataScript } from "@/app/components/StructuredDataScript";
import PhonePageClient from "@/app/features/phone/PhonePageClient";
import { createPhoneAnswerSummary } from "@/lib/academic-aeo";
import { getKoreaNow } from "@/lib/home";
import {
  LOCALE_HEADER_NAME,
  getDictionary,
  localizePath,
  normalizeLocale,
} from "@/lib/i18n";
import { getHomePhoneNumbers } from "@/lib/server/home-data";
import { createFAQPageSchema } from "@/lib/structured-data";

const CSP_NONCE_HEADER_NAME = "x-csp-nonce";
const SITE_ORIGIN = "https://campus.syu.kr";

type PhonePageProps = {
  canonicalPath: "/campus/phone" | "/more/phone";
};

export async function PhonePage({ canonicalPath }: PhonePageProps) {
  const headerStore = await headers();
  const locale = normalizeLocale(headerStore.get(LOCALE_HEADER_NAME));
  const nonce = headerStore.get(CSP_NONCE_HEADER_NAME) || undefined;
  const now = getKoreaNow();
  const initialPhoneNumbers = await getHomePhoneNumbers();
  const answerSummary = createPhoneAnswerSummary({
    locale,
    now,
    phoneNumbers: initialPhoneNumbers,
  });
  const dictionary = getDictionary(locale);
  const schemaId =
    canonicalPath === "/campus/phone"
      ? "campus-phone-answer-schema"
      : "more-phone-answer-schema";

  return (
    <>
      <StructuredDataScript
        id={schemaId}
        nonce={nonce}
        data={createFAQPageSchema({
          inLanguage: dictionary.meta.inLanguage,
          mainEntity: [
            {
              acceptedAnswerText: answerSummary.answer,
              questionName: answerSummary.question,
            },
          ],
          url: `${SITE_ORIGIN}${localizePath(canonicalPath, locale)}`,
        })}
      />
      <PhonePageClient
        answerSummary={answerSummary}
        initialPhoneNumbers={initialPhoneNumbers}
      />
    </>
  );
}
