import type { Locale } from "@/lib/i18n";

const labels = {
  ko: {
    title: "룸메이트 구하기",
    verifyTitle: "학교 이메일로 시작하기",
  },
  en: {
    title: "Find a roommate",
    verifyTitle: "Start with your school email",
  },
};

export function getRoommateNavigationText(locale: Locale) {
  return locale === "en" ? labels.en : labels.ko;
}
