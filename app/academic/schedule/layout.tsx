import { createPageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  LOCALE_HEADER_NAME,
  createLocalizedAlternates,
  getDictionary,
  normalizeLocale,
} from "@/lib/i18n";

async function getCurrentLocale() {
  const headerStore = await headers();
  return normalizeLocale(headerStore.get(LOCALE_HEADER_NAME));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getCurrentLocale();
  const text = getDictionary(locale).pages.academicSchedule;

  return {
    ...createPageMetadata({
      title: text.metaTitle,
      description: text.metaDescription,
      pathname: "/academic/schedule",
      locale,
    }),
    alternates: createLocalizedAlternates("/academic/schedule", locale),
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
