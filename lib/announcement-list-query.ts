import type { Metadata } from "next";
import { getDictionary } from "./i18n";
import { createLocalizedAlternates, type Locale } from "./i18n/routing";
import { createPageMetadata } from "./page-metadata";

export type AnnouncementListSearchParams = Record<string, string | string[] | undefined>;

export function getAnnouncementListQuery(params: AnnouncementListSearchParams) {
  const search = Array.isArray(params.search) ? params.search[0] : params.search;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const requestedPage = Number(rawPage);

  return {
    query: search ?? "",
    page: Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.floor(requestedPage) : 1,
  };
}

export function getAnnouncementListMetadata(
  pathname: string,
  params: AnnouncementListSearchParams,
  locale: Locale,
): Metadata {
  const { page, query } = getAnnouncementListQuery(params);
  const isSearch = Boolean(query.trim());
  const canonicalPath = !isSearch && page > 1 ? `${pathname}?page=${page}` : pathname;
  const dictionary = getDictionary(locale);
  const text = dictionary.pages.announcements;
  const listText: Record<string, { title: string; description: string }> = {
    "/announcements": { title: text.allTitle, description: text.allDescription },
    "/academic/announcements": { title: text.academicTitle, description: text.academicDescription },
    "/academic/sw-notices": { title: text.swTitle, description: text.swDescription },
    "/campus/announcements": { title: text.campusTitle, description: text.campusDescription },
    "/academic/scholarship": { title: dictionary.pages.scholarship.title, description: dictionary.pages.scholarship.metaDescription },
  };
  const pageText = listText[pathname] ?? listText["/announcements"];
  const { openGraph, twitter } = createPageMetadata({
    title: `${pageText.title} | SYU CAMPUS`,
    description: pageText.description,
    pathname: canonicalPath,
    locale,
  });

  return {
    openGraph,
    twitter,
    alternates: createLocalizedAlternates(canonicalPath, locale),
    ...(isSearch ? { robots: { index: false, follow: true } } : {}),
  };
}
