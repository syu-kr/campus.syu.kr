import type { Metadata } from "next";
import { headers } from "next/headers";

import {
  LOCALE_HEADER_NAME,
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
    title: `${dictionary.campus.menus.busTitle} | SYU CAMPUS`,
    description: dictionary.campus.menus.busDescription,
    openGraph: {
      title: `${dictionary.campus.menus.busTitle} | SYU CAMPUS`,
      description: dictionary.campus.menus.busDescription,
      type: "website",
      url: `https://campus.syu.kr${localizePath("/campus/bus-info", locale)}`,
    },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
