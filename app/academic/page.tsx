import { createPageMetadata } from "@/lib/page-metadata";
import { Metadata } from "next";
import { headers } from "next/headers";

import { AcademicMenuGrid } from "@/app/academic/AcademicMenuGrid";
import { Container } from "@/app/components/Container";
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
      title: `${dictionary.academic.title} | SYU CAMPUS`,
      description: dictionary.academic.metaDescription,
      pathname: "/academic",
      locale,
    }),
    keywords:
      locale === "en"
        ? "academic, academic schedule, academic notices, graduation, timetable"
        : "학사,학사일정,학사공지,졸업요건,시간표",
  };
}

export default async function AcademicPage() {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          {dictionary.academic.title}
        </h1>
        <p className="text-neutral-600">{dictionary.academic.description}</p>
      </div>

      <AcademicMenuGrid />
    </Container>
  );
}
