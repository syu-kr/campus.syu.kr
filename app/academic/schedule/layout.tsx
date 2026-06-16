import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  LOCALE_HEADER_NAME,
  getDictionary,
  localizePath,
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
    title: text.metaTitle,
    description: text.metaDescription,
    alternates: {
      canonical: localizePath("/academic/schedule", locale),
    },
    openGraph: {
      title: text.metaTitle,
      description: text.metaDescription,
      url: `https://campus.syu.kr${localizePath(
        "/academic/schedule",
        locale,
      )}`,
    },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
