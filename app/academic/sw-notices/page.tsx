"use client";

import { AnnouncementListPage } from "@/app/components/AnnouncementListPage";
import { useDictionary } from "@/app/components/LocaleProvider";

export default function SwNoticesPage() {
  const dictionary = useDictionary();

  return (
    <AnnouncementListPage
      category="sw"
      title={dictionary.pages.announcements.swTitle}
      description={dictionary.pages.announcements.swDescription}
      errorMessage={dictionary.pages.announcements.swError}
    />
  );
}
