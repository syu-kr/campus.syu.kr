import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { CompetitionsPageClient } from "@/app/features/academic/CompetitionsPageClient";
import { getCompetitionPage } from "@/lib/server/competitions";
import { getCompetitionListQuery, getPublicListMetadata, replaceListParams } from "@/lib/public-list-query";
import { LOCALE_HEADER_NAME, getDictionary, normalizeLocale, localizePath } from "@/lib/i18n";
import { createPageMetadata } from "@/lib/page-metadata";
import type { AnnouncementListSearchParams } from "@/lib/announcement-list-query";

type PageProps = { searchParams?: Promise<AnnouncementListSearchParams> };

export async function generateMetadata({ searchParams = Promise.resolve({}) }: PageProps = {}) {
  const [params, headerStore] = await Promise.all([searchParams, headers()]);
  const locale = normalizeLocale(headerStore.get(LOCALE_HEADER_NAME));
  const text = getDictionary(locale).pages.competitions;
  const query = getCompetitionListQuery(params);
  const filtered = Boolean(query.query.trim()) || query.source !== "all" || query.status !== "open";
  const pathname = !filtered && query.page > 1 ? `/academic/competitions?page=${query.page}` : "/academic/competitions";
  return {
    ...createPageMetadata({ title: `${text.title} | SYU CAMPUS`, description: text.metaDescription, pathname, locale }),
    ...getPublicListMetadata("/academic/competitions", query.page, filtered, locale),
  };
}

export default async function AcademicCompetitionsPage({ searchParams = Promise.resolve({}) }: PageProps = {}) {
  const params = await searchParams;
  const initialQuery = getCompetitionListQuery(params);
  const initialPage = await getCompetitionPage({ ...initialQuery, query: initialQuery.query.slice(0, 100), limit: 10 }).catch(error => {
    unstable_rethrow(error);
    return undefined;
  });
  if (initialPage && initialQuery.page > initialPage.totalPages) {
    const locale = normalizeLocale((await headers()).get(LOCALE_HEADER_NAME));
    redirect(localizePath(`/academic/competitions${replaceListParams(params, { page: initialPage.totalPages > 1 ? String(initialPage.totalPages) : undefined })}`, locale));
  }
  return <CompetitionsPageClient initialPage={initialPage} initialQuery={initialQuery} />;
}
