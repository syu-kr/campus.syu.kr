"use client";

import { AnnouncementListPage } from "@/app/components/AnnouncementListPage";

export default function CampusAnnouncementsPage() {
  return (
    <AnnouncementListPage
      category="campus"
      title="캠퍼스공지"
      description="캠퍼스 생활 및 주요 공지사항을 확인하세요"
      errorMessage="캠퍼스공지를 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
    />
  );
}
