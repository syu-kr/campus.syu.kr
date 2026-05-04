"use client";

import { AnnouncementListPage } from "@/app/components/AnnouncementListPage";

export default function AcademicAnnouncementsPage() {
  return (
    <AnnouncementListPage
      category="academic"
      title="학사공지"
      description="학사 관련 주요 공지사항을 확인하세요"
      errorMessage="학사공지를 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
    />
  );
}
