"use client";

import { AnnouncementListPage } from "@/app/components/AnnouncementListPage";
import { useDictionary } from "@/app/components/LocaleProvider";

export default function CampusAnnouncementsPage() {
  const dictionary = useDictionary();

  return (
    <AnnouncementListPage
      category="campus"
      title={dictionary.pages.announcements.campusTitle}
      description={dictionary.pages.announcements.campusDescription}
      errorMessage={dictionary.pages.announcements.campusError}
    />
  );
}
