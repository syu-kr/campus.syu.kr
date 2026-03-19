"use client";

import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { Skeleton } from "@/app/components/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { fetchAnnouncements } from "@/lib/api";
import { AnnouncementCard } from "@/app/components/AnnouncementCard";

export default function AcademicAnnouncementsPage() {
  const { data: announcements, isLoading } = useQuery({
    queryKey: ["announcements", "academic"],
    queryFn: () => fetchAnnouncements("academic"),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          학사공지
        </h1>
        <p className="text-neutral-600">학사 관련 주요 공지사항을 확인하세요</p>
      </div>

      <div className="space-y-3">
        {isLoading && <Skeleton count={5} />}
        {!isLoading &&
          announcements &&
          announcements.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              href={`/announcements/${announcement.id}`}
            />
          ))}
      </div>

      {!isLoading && announcements?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-neutral-600">공지사항이 없습니다</p>
        </div>
      )}
    </Container>
  );
}
