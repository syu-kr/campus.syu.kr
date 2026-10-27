import { headers } from "next/headers";
import { AnnouncementListPage } from "@/app/components/AnnouncementListPage";
import { LOCALE_HEADER_NAME, getDictionary, normalizeLocale } from "@/lib/i18n";
import { getAnnouncementPage } from "@/lib/server/announcements";
import { getAnnouncementListMetadata, getAnnouncementListQuery, type AnnouncementListSearchParams } from "@/lib/announcement-list-query";

export async function generateMetadata({
  searchParams = Promise.resolve({}),
}: { searchParams?: Promise<AnnouncementListSearchParams> } = {}) {
  const [params, headerStore] = await Promise.all([searchParams, headers()]);
  return getAnnouncementListMetadata("/academic/scholarship", params, normalizeLocale(headerStore.get(LOCALE_HEADER_NAME)));
}

export default async function ScholarshipPage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<AnnouncementListSearchParams>;
} = {}) {
  const listQuery = getAnnouncementListQuery(await searchParams);
  const [headerStore, initialPage] = await Promise.all([
    headers(),
    getAnnouncementPage({ category: "scholarship", ...listQuery }),
  ]);
  const dictionary = getDictionary(normalizeLocale(headerStore.get(LOCALE_HEADER_NAME)));

  return (
    <AnnouncementListPage
      category="scholarship"
      initialPage={initialPage}
      initialQuery={listQuery.query}
      title={dictionary.pages.scholarship.title}
      description={dictionary.pages.scholarship.description}
      errorMessage={dictionary.pages.announcements.allError}
    />
  );
}
