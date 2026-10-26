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

  return createPageMetadata({
    title: `${dictionary.pages.notificationPrivacy.title} | SYU CAMPUS`,
    description: dictionary.pages.notificationPrivacy.metaDescription,
    pathname: "/more/privacy",
    locale,
  });
}

export default function NotificationPrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
