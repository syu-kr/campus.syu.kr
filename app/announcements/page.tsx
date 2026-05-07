"use client";

import { AnnouncementListPage } from "@/app/components/AnnouncementListPage";

export default function AnnouncementsPage() {
  return (
    <AnnouncementListPage
      category="all"
      title="전체 공지"
      description="학사공지, 캠퍼스공지, 장학금 공지를 최신순으로 확인하세요"
      errorMessage="공지를 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
    />
  );
}
