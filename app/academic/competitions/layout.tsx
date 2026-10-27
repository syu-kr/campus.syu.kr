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
  const text = getDictionary(locale).pages.competitions;

  return createPageMetadata({
    title: `${text.title} | SYU CAMPUS`,
    description: text.metaDescription,
    pathname: "/academic/competitions",
    locale,
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
