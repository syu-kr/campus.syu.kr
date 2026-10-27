import { createPageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";
import { headers } from "next/headers";

import {
  LOCALE_HEADER_NAME,
  getDictionary,
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
    ...createPageMetadata({
      title: `${dictionary.pages.campusTipsSuggest.title} | SYU CAMPUS`,
      description: dictionary.pages.campusTipsSuggest.metaDescription,
      pathname: "/campus/campus-tips/suggest",
      locale,
    }),
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default function CampusTipSuggestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
