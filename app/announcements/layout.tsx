import type { Metadata } from "next";
import type { ReactNode } from "react";
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
  const text = getDictionary(locale).pages.announcements;

  return {
    title: `${text.allTitle} | SYU CAMPUS`,
    description: text.allDescription,
  };
}

export default function AnnouncementsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
