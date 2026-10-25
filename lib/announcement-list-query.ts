import type { Metadata } from "next";
import { createLocalizedAlternates, type Locale } from "./i18n";

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

  return {
    alternates: createLocalizedAlternates(canonicalPath, locale),
    ...(isSearch ? { robots: { index: false, follow: true } } : {}),
  };
}
