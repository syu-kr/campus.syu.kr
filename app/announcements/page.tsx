"use client";

import { AnnouncementListPage } from "@/app/components/AnnouncementListPage";
import { useDictionary } from "@/app/components/LocaleProvider";

export default function AnnouncementsPage() {
  const dictionary = useDictionary();

  return (
    <AnnouncementListPage
      category="all"
      title={dictionary.pages.announcements.allTitle}
      description={dictionary.pages.announcements.allDescription}
      errorMessage={dictionary.pages.announcements.allError}
    />
  );
}
