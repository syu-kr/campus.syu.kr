"use client";

import { Container } from "@/app/components/Container";
import { Skeleton } from "@/app/components/Skeleton";
import { AnnouncementCard } from "@/app/components/AnnouncementCard";
import { useQuery } from "@tanstack/react-query";
import { fetchAnnouncements } from "@/lib/api";
import { useState } from "react";

const categoryFilters = [
  { id: "all", label: "전체", value: undefined },
  { id: "academic", label: "학사", value: "academic" },
  { id: "scholarship", label: "장학", value: "scholarship" },
  { id: "campus", label: "캠퍼스", value: "campus" },
  { id: "admin", label: "행정", value: "admin" },
];

export default function AnnouncementsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    undefined,
  );

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["announcements", selectedCategory],
    queryFn: () =>
      fetchAnnouncements(
        selectedCategory as
          | "academic"
          | "scholarship"
          | "campus"
          | "admin"
          | "activity"
          | undefined,
      ),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">공지사항</h1>
        <p className="text-neutral-600">
          삼육대학교의 모든 공지사항을 한눈에 확인하세요
        </p>
      </div>

      {/* 카테고리 필터 */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {categoryFilters.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat.value
                ? "bg-primary-600 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 공지사항 목록 */}
      <div className="space-y-3">
        {isLoading && <Skeleton count={5} />}
        {!isLoading && announcements && announcements.length === 0 && (
          <div className="text-center py-12">
            <p className="text-neutral-600">공지사항이 없습니다</p>
          </div>
        )}
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
    </Container>
  );
}
