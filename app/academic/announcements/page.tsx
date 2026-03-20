"use client";

import { Container } from "@/app/components/Container";
import { Skeleton } from "@/app/components/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { fetchAnnouncements } from "@/lib/api";
import { AnnouncementCard } from "@/app/components/AnnouncementCard";
import { useState, useMemo } from "react";

const ITEMS_PER_PAGE = 10;

export default function AcademicAnnouncementsPage() {
  const { data: announcements, isLoading } = useQuery({
    queryKey: ["announcements", "academic"],
    queryFn: () => fetchAnnouncements("academic"),
    staleTime: 5 * 60 * 1000,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // 검색 필터링
  const filteredAnnouncements = useMemo(() => {
    if (!announcements) return [];
    if (!searchQuery.trim()) return announcements;

    const lowerQuery = searchQuery.toLowerCase();
    return announcements.filter(
      (a) =>
        a.title.toLowerCase().includes(lowerQuery) ||
        a.author.toLowerCase().includes(lowerQuery),
    );
  }, [announcements, searchQuery]);

  // 페이지네이션
  const totalPages = Math.ceil(filteredAnnouncements.length / ITEMS_PER_PAGE);
  const paginatedAnnouncements = filteredAnnouncements.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // 검색 결과가 변경되면 첫 페이지로
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          학사공지
        </h1>
        <p className="text-neutral-600">학사 관련 주요 공지사항을 확인하세요</p>
      </div>

      {/* 검색 바 */}
      <div className="mb-6 relative">
        <input
          type="text"
          placeholder="제목 또는 작성자로 검색..."
          value={searchQuery}
          onChange={handleSearch}
          className="w-full px-4 py-2 pr-10 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery("");
              setCurrentPage(1);
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
            aria-label="검색 초기화"
          >
            ✕
          </button>
        )}
      </div>

      {/* 결과 수 표시 */}
      {!isLoading && (
        <div className="mb-4 text-sm text-neutral-600">
          {filteredAnnouncements.length}개 항목 찾음
          {searchQuery && ` (검색어: "${searchQuery}")`}
        </div>
      )}

      <div className="space-y-3 mb-6">
        {isLoading && <Skeleton count={5} />}
        {!isLoading && paginatedAnnouncements.length === 0 && (
          <div className="py-8 text-center text-neutral-500">
            검색 결과가 없습니다.
          </div>
        )}
        {!isLoading &&
          paginatedAnnouncements.map((announcement) => (
            <div key={announcement.id} className="mb-2">
              <AnnouncementCard
                announcement={announcement}
                href={announcement.url}
                external={true}
              />
            </div>
          ))}
      </div>

      {/* 페이지네이션 */}
      {!isLoading && totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded-lg bg-neutral-200 text-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-300 transition-colors"
          >
            ← 이전
          </button>

          <div className="text-sm text-neutral-600">
            {currentPage} / {totalPages}
          </div>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 rounded-lg bg-neutral-200 text-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-300 transition-colors"
          >
            다음 →
          </button>
        </div>
      )}
    </Container>
  );
}
