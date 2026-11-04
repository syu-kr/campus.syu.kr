import type { Dictionary, Locale } from "@/lib/i18n";
import type { PhoneNumber } from "@/types";

export const PHONE_DIRECTORY_SOURCE_URL =
  "https://www.syu.ac.kr/about-sahmyook/phone-number-information/";

type GraduationMetadata = {
  sourceTitle: string;
  lastVerifiedAt: string;
};

export function createGraduationAnswerSummary({
  metadata,
  text,
}: {
  metadata: GraduationMetadata;
  text: Dictionary["pages"]["graduation"]["answer"];
}) {
  return {
    question: text.question,
    answer: applyTemplate(text.body, {
      lastVerifiedAt: metadata.lastVerifiedAt,
      sourceTitle: metadata.sourceTitle,
    }),
  };
}

export function createPhoneAnswerSummary({
  locale,
  phoneNumbers,
  text,
}: {
  locale: Locale;
  phoneNumbers: PhoneNumber[];
  text: Dictionary["pages"]["phone"]["answer"];
}) {
  const academicContact = phoneNumbers.find(
    (phone) =>
      phone.department.includes("학사지원팀") ||
      phone.description?.includes("학적"),
  );
  const answer = academicContact
    ? applyTemplate(text.body, {
        count: phoneNumbers.length.toLocaleString(
          locale === "ko" ? "ko-KR" : "en-US",
        ),
        department: academicContact.department,
        description: academicContact.description ?? text.noDescription,
        phone: academicContact.phone,
      })
    : phoneNumbers.length ? text.academicUnavailableBody : text.emptyBody;

  return {
    question: text.question,
    answer,
    source: text.source,
  };
}

function applyTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  );
}
