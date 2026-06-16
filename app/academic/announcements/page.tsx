"use client";

import { AnnouncementListPage } from "@/app/components/AnnouncementListPage";
import { useDictionary } from "@/app/components/LocaleProvider";

export default function AcademicAnnouncementsPage() {
  const dictionary = useDictionary();

  return (
    <AnnouncementListPage
      category="academic"
      title={dictionary.pages.announcements.academicTitle}
      description={dictionary.pages.announcements.academicDescription}
      errorMessage={dictionary.pages.announcements.academicError}
    />
  );
}
