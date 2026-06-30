"use client";

import { AnnouncementListPage } from "@/app/components/AnnouncementListPage";
import { useDictionary } from "@/app/components/LocaleProvider";

export default function ScholarshipPage() {
  const dictionary = useDictionary();

  return (
    <AnnouncementListPage
      category="scholarship"
      title={dictionary.pages.scholarship.title}
      description={dictionary.pages.scholarship.description}
      errorMessage={dictionary.pages.announcements.allError}
    />
  );
}
