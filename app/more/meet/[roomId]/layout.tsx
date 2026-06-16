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
    title: `${dictionary.pages.meetRoom.metaTitle} | SYU CAMPUS`,
    robots: {
      index: false,
      follow: false,
      nocache: true,
    },
  };
}

export default function MeetRoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
