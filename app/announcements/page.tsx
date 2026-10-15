import { headers } from "next/headers";
import { AnnouncementListPage } from "@/app/components/AnnouncementListPage";
import { LOCALE_HEADER_NAME, getDictionary, normalizeLocale } from "@/lib/i18n";
import { getAnnouncementPage } from "@/lib/server/announcements";

export default async function AnnouncementsPage() {
  const [headerStore, initialPage] = await Promise.all([
    headers(),
    getAnnouncementPage({ category: "all" }),
  ]);
  const dictionary = getDictionary(normalizeLocale(headerStore.get(LOCALE_HEADER_NAME)));

  return (
    <AnnouncementListPage
      category="all"
      initialPage={initialPage}
      title={dictionary.pages.announcements.allTitle}
      description={dictionary.pages.announcements.allDescription}
      errorMessage={dictionary.pages.announcements.allError}
    />
  );
}
