import { headers } from "next/headers";
import { AnnouncementListPage } from "@/app/components/AnnouncementListPage";
import { LOCALE_HEADER_NAME, getDictionary, normalizeLocale } from "@/lib/i18n";
import { getAnnouncementPage } from "@/lib/server/announcements";

export default async function SwNoticesPage() {
  const [headerStore, initialPage] = await Promise.all([
    headers(),
    getAnnouncementPage({ category: "sw" }),
  ]);
  const dictionary = getDictionary(normalizeLocale(headerStore.get(LOCALE_HEADER_NAME)));

  return (
    <AnnouncementListPage
      category="sw"
      initialPage={initialPage}
      title={dictionary.pages.announcements.swTitle}
      description={dictionary.pages.announcements.swDescription}
      errorMessage={dictionary.pages.announcements.swError}
    />
  );
}
