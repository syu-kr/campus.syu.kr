import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { AnnouncementDetailSkeleton } from "@/app/components/PageLoadingSkeletons";
import { StructuredDataScript } from "@/app/components/StructuredDataScript";
import { AnnouncementDetailArticle } from "../../AnnouncementDetailArticle";
import {
  getAnnouncementById,
} from "@/lib/server/announcements";
import {
  LOCALE_HEADER_NAME,
  createLocalizedAlternates,
  getDictionary,
  localizePath,
  normalizeLocale,
} from "@/lib/i18n";
import { createArticleSchema } from "@/lib/structured-data";
import { createPageMetadata } from "@/lib/page-metadata";
import { getAnnouncementDetailPath } from "@/lib/announcement-path";
import type { AnnouncementCategory } from "@/types";

interface AnnouncementDetailPageProps {
  params: Promise<{
    category: string;
    id: string;
  }>;
}

export const runtime = "nodejs";

const CSP_NONCE_HEADER_NAME = "x-csp-nonce";
const SITE_ORIGIN = "https://campus.syu.kr";
const VALID_CATEGORIES: AnnouncementCategory[] = [
  "academic",
  "campus",
  "scholarship",
  "sw",
];

async function getRequestContext() {
  const headerStore = await headers();

  return {
    locale: normalizeLocale(headerStore.get(LOCALE_HEADER_NAME)),
    nonce: headerStore.get(CSP_NONCE_HEADER_NAME) || undefined,
  };
}

export async function generateMetadata({
  params,
}: AnnouncementDetailPageProps): Promise<Metadata> {
  const { category, id } = await params;
  const locale = (await getRequestContext()).locale;
  const text = getDictionary(locale).pages.announcements;
  const normalizedCategory = normalizeAnnouncementCategory(category);
  const announcement = normalizedCategory
    ? await getAnnouncementById(normalizedCategory, id)
    : null;

  if (!announcement) {
    return {
      title: text.detailFallbackTitle,
      description: text.detailFallbackDescription,
    };
  }

  const description =
    announcement.aiSummary?.summary ||
    announcement.content ||
    text.detailFallbackDescription;
  const detailPath = getAnnouncementDetailPath(announcement.category, announcement.id);

  return {
    ...createPageMetadata({
      title: `${announcement.title} | SYU CAMPUS`,
      description,
      pathname: detailPath,
      locale,
      contentLocale: "ko",
      type: "article",
    }),
    alternates: createLocalizedAlternates(detailPath, locale),
  };
}

export default function AnnouncementDetailPage(
  props: AnnouncementDetailPageProps,
) {
  return (
    <Suspense fallback={<AnnouncementDetailSkeleton />}>
      <AnnouncementDetailContent {...props} />
    </Suspense>
  );
}

async function AnnouncementDetailContent({
  params,
}: AnnouncementDetailPageProps) {
  const { category, id } = await params;
  const { locale, nonce } = await getRequestContext();
  const normalizedCategory = normalizeAnnouncementCategory(category);

  if (!normalizedCategory) notFound();

  const announcement = await getAnnouncementById(normalizedCategory, id);
  if (!announcement) notFound();

  const dictionary = getDictionary(locale);
  const text = dictionary.pages.announcements;
  const detailPath = getAnnouncementDetailPath(announcement.category, announcement.id);
  const detailUrl = `${SITE_ORIGIN}${localizePath(detailPath, locale)}`;
  const articleDescription =
    announcement.aiSummary?.summary ||
    announcement.content ||
    text.detailFallbackDescription;

  return (
    <>
      <StructuredDataScript
        id="announcement-article-schema"
        nonce={nonce}
        data={createArticleSchema({
          authorName:
            announcement.author || dictionary.labels.sahmyookUniversity,
          datePublished: toIsoDate(announcement.date),
          description: articleDescription,
          headline: announcement.title,
          inLanguage: "ko-KR",
          keywords: announcement.aiSummary?.keywords,
          url: detailUrl,
        })}
      />
      <Container>
        <div className="py-6 md:py-8">
          <Card className="mb-6 md:mb-8" hover={false}>
            <AnnouncementDetailArticle announcement={announcement} locale={locale} />
          </Card>
          <Link
            href={localizePath("/announcements", locale)}
            prefetch={false}
            className="mb-6 inline-flex items-center gap-2 font-medium text-primary-600 transition-colors hover:text-primary-700"
          >
            <span aria-hidden="true">←</span>
            {text.backToList}
          </Link>
        </div>
      </Container>
    </>
  );
}

function normalizeAnnouncementCategory(
  value: string,
): AnnouncementCategory | null {
  return VALID_CATEGORIES.includes(value as AnnouncementCategory)
    ? (value as AnnouncementCategory)
    : null;
}

function toIsoDate(value: string) {
  const normalized = value.replace(/\./g, "-");
  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
