import type { Metadata } from "next";
import { headers } from "next/headers";
import { createPageMetadata } from "@/lib/page-metadata";

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
      title: `${dictionary.pages.meetRoom.metaTitle} | SYU CAMPUS`,
      description: dictionary.pages.meet.metaDescription,
      pathname: "/more/meet",
      locale,
    }),
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
