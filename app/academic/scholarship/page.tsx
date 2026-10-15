import { headers } from "next/headers";
import { AnnouncementListPage } from "@/app/components/AnnouncementListPage";
import { LOCALE_HEADER_NAME, getDictionary, normalizeLocale } from "@/lib/i18n";
import { getAnnouncementPage } from "@/lib/server/announcements";

export default async function ScholarshipPage() {
  const [headerStore, initialPage] = await Promise.all([
    headers(),
    getAnnouncementPage({ category: "scholarship" }),
  ]);
  const dictionary = getDictionary(normalizeLocale(headerStore.get(LOCALE_HEADER_NAME)));

  return (
    <AnnouncementListPage
      category="scholarship"
      initialPage={initialPage}
      title={dictionary.pages.scholarship.title}
      description={dictionary.pages.scholarship.description}
      errorMessage={dictionary.pages.announcements.allError}
    />
  );
}
