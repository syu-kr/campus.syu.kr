import type { Metadata } from "next";
import { headers } from "next/headers";

import {
  LOCALE_HEADER_NAME,
  createLocalizedAlternates,
  getDictionary,
  localizePath,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n";

async function getRequestLocale(): Promise<Locale> {
  const headerStore = await headers();
  return normalizeLocale(headerStore.get(LOCALE_HEADER_NAME));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);

  return {
    title: `${dictionary.pages.scholarship.title} | SYU CAMPUS`,
    description: dictionary.pages.scholarship.metaDescription,
    alternates: createLocalizedAlternates("/academic/scholarship", locale),
    robots: {
      index: false,
      follow: true,
    },
    openGraph: {
      title: `${dictionary.pages.scholarship.title} | SYU CAMPUS`,
      description: dictionary.pages.scholarship.metaDescription,
      type: "website",
      url: `https://campus.syu.kr${localizePath(
        "/academic/scholarship",
        locale,
      )}`,
    },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
