import { readPublicDataJson } from "@/lib/server/public-data";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import CampusTipsPage from "@/app/features/campus-tips/CampusTipsPageClient";
import { getCampusTipsListQuery, getPublicListMetadata, replaceListParams } from "@/lib/public-list-query";
import { filterCampusTips, getCampusTipsAvailableCategories } from "@/lib/campus-tip-filters";
import { LOCALE_HEADER_NAME, getDictionary, normalizeLocale, localizePath } from "@/lib/i18n";
import { createPageMetadata } from "@/lib/page-metadata";
import type { AnnouncementListSearchParams } from "@/lib/announcement-list-query";
import type { CampusTip } from "@/types";

type PageProps = { searchParams?: Promise<AnnouncementListSearchParams> };

export async function generateMetadata({ searchParams = Promise.resolve({}) }: PageProps = {}) {
  const [params, headerStore] = await Promise.all([searchParams, headers()]);
  const locale = normalizeLocale(headerStore.get(LOCALE_HEADER_NAME));
  const text = getDictionary(locale).pages.campusTips;
  const query = getCampusTipsListQuery(params);
  const filtered = Boolean(query.query.trim()) || query.view !== "campus-tips" || query.category !== "all";
  const pathname = !filtered && query.page > 1 ? `/campus/campus-tips?page=${query.page}` : "/campus/campus-tips";
  return {
    ...createPageMetadata({ title: `${text.title} | SYU CAMPUS`, description: text.metaDescription, pathname, locale }),
    ...getPublicListMetadata("/campus/campus-tips", query.page, filtered, locale),
  };
}

export default async function CampusTipsListPage({ searchParams = Promise.resolve({}) }: PageProps = {}) {
  const params = await searchParams;
  const initialTips = await readPublicDataJson<CampusTip[]>("campus-tips.json")
    .catch(error => { unstable_rethrow(error); return undefined; });
  if (initialTips) {
    const query = getCampusTipsListQuery(params);
    const locale = normalizeLocale((await headers()).get(LOCALE_HEADER_NAME));
    const category = getCampusTipsAvailableCategories(initialTips, query.view).includes(query.category) ? query.category : "all";
    const count = filterCampusTips(initialTips, { ...query, category }, locale, getDictionary(locale).pages.campusTips).length;
    const page = Math.min(query.page, Math.max(1, Math.ceil(count / 12)));
    if (page !== query.page || category !== query.category) {
      redirect(localizePath(`/campus/campus-tips${replaceListParams(params, { page: page > 1 ? String(page) : undefined, category: category === "all" ? undefined : category })}`, locale));
    }
  }
  return <CampusTipsPage initialTips={initialTips} />;
}
