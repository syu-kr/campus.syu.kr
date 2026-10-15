import { headers } from "next/headers";
import { AnnouncementListPage } from "@/app/components/AnnouncementListPage";
import { LOCALE_HEADER_NAME, getDictionary, normalizeLocale } from "@/lib/i18n";
import { getAnnouncementPage } from "@/lib/server/announcements";

export default async function AcademicAnnouncementsPage() {
  const [headerStore, initialPage] = await Promise.all([
    headers(),
    getAnnouncementPage({ category: "academic" }),
  ]);
  const dictionary = getDictionary(normalizeLocale(headerStore.get(LOCALE_HEADER_NAME)));

  return (
    <AnnouncementListPage
      category="academic"
      initialPage={initialPage}
      title={dictionary.pages.announcements.academicTitle}
      description={dictionary.pages.announcements.academicDescription}
      errorMessage={dictionary.pages.announcements.academicError}
    />
  );
}
