import { createPageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllServiceNotices,
  getServiceNoticeBySlug,
} from "@/lib/serviceNotices";
import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { getAnnouncementListQuery, type AnnouncementListSearchParams } from "@/lib/announcement-list-query";
import {
  LOCALE_HEADER_NAME,
  getDictionary,
  localizePath,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n";
import { ServiceNoticeArticle } from "../ServiceNoticeArticle";

interface ServiceNoticeDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<AnnouncementListSearchParams>;
}

export const dynamicParams = true;

async function getCurrentLocale(): Promise<Locale> {
  const headerStore = await headers();
  return normalizeLocale(headerStore.get(LOCALE_HEADER_NAME));
}

export async function generateStaticParams() {
  const notices = await getAllServiceNotices();
  return notices.map((notice) => ({
    slug: notice.slug,
  }));
}

export async function generateMetadata({
  params,
}: ServiceNoticeDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getCurrentLocale();
  const text = getDictionary(locale).pages.serviceNotices;
  const notice = await getServiceNoticeBySlug(slug, locale);
  if (!notice) notFound();

  return createPageMetadata({
    title: notice?.title || text.detailFallbackTitle,
    description: notice?.description || text.detailFallbackDescription,
    pathname: `/service/notices/${slug}`,
    locale,
    contentLocale: notice?.lang ?? "ko",
  });
}

export default async function ServiceNoticeDetailPage({
  params,
  searchParams = Promise.resolve({}),
}: ServiceNoticeDetailPageProps) {
  const { slug } = await params;
  const locale = await getCurrentLocale();
  const text = getDictionary(locale).pages.serviceNotices;
  const notice = await getServiceNoticeBySlug(slug, locale);
  const dateLocale = locale === "en" ? "en-US" : "ko-KR";
  const listPage = getAnnouncementListQuery({ page: (await searchParams).listPage }).page;
  const listHref = localizePath(`/service/notices${listPage > 1 ? `?page=${listPage}` : ""}`, locale);

  if (!notice) notFound();

  return (
    <Container>
      <div className="py-6 md:py-8">
        <Card className="mb-6 md:mb-8">
          <ServiceNoticeArticle notice={notice} locale={locale}>
            <div className="flex flex-wrap items-center gap-3 md:gap-4 py-4 border-b border-neutral-200 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-600">
                  {text.author}
                </span>
                <span lang="ko" className="text-sm font-medium text-neutral-900">
                  {notice.author}
                </span>
              </div>
              <span className="text-neutral-300">•</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-600">{text.date}</span>
                <time className="text-sm font-medium text-neutral-900">
                  {new Date(notice.date).toLocaleDateString(dateLocale, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              </div>
            </div>

          </ServiceNoticeArticle>
        </Card>
        <Link
          href={listHref}
          prefetch={false}
          className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {text.backToList}
        </Link>
      </div>
    </Container>
  );
}
