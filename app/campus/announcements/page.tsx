"use client";

import { Container } from "@/app/components/Container";
import { Skeleton } from "@/app/components/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { fetchAnnouncements } from "@/lib/api";
import { AnnouncementCard } from "@/app/components/AnnouncementCard";
import { useState, useMemo } from "react";

const ITEMS_PER_PAGE = 10;

export default function CampusAnnouncementsPage() {
  const { data: announcements, isLoading } = useQuery({
    queryKey: ["announcements", "campus"],
    queryFn: () => fetchAnnouncements("campus"),
    staleTime: 0,
    gcTime: 0,
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

  // 페이지 범위: 모바일은 5개, 데스크톱은 10개
  const pageRange =
    typeof window !== "undefined" && window.innerWidth < 768 ? 5 : 10;
  const startPage = Math.max(1, currentPage - Math.floor(pageRange / 2));
  const endPage = Math.min(totalPages, startPage + pageRange - 1);
  const adjustedStartPage = Math.max(1, endPage - pageRange + 1);

  // 검색 결과가 변경되면 첫 페이지로
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          캠퍼스공지
        </h1>
        <p className="text-neutral-600">
          캠퍼스 생활 및 주요 공지사항을 확인하세요
        </p>
      </div>

      {/* 검색 바 */}
      <div className="mb-6 relative">
        <input
          type="text"
          placeholder="제목 또는 작성자로 검색..."
          value={searchQuery}
          onChange={handleSearch}
          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 pr-10"
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery("");
              setCurrentPage(1);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1"
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
        <div className="flex justify-center items-center gap-1 md:gap-2 mt-8 flex-wrap">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-2 md:px-3 py-2 rounded-lg bg-neutral-200 text-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-300 transition-colors text-sm"
          >
            이전
          </button>

          {/* 모바일: 5개, 데스크톱: 10개 페이지 표시 */}
          {Array.from(
            { length: Math.min(pageRange, endPage - adjustedStartPage + 1) },
            (_, i) => adjustedStartPage + i,
          ).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`px-2 md:px-3 py-2 rounded-lg transition-colors text-sm ${
                currentPage === page
                  ? "bg-primary-600 text-white"
                  : "bg-neutral-200 text-neutral-900 hover:bg-neutral-300"
              }`}
            >
              {page}
            </button>
          ))}

          {/* 더 많은 페이지가 있으면 드롭다운 */}
          {totalPages > pageRange && endPage < totalPages && (
            <select
              value={currentPage}
              onChange={(e) => setCurrentPage(parseInt(e.target.value))}
              className="px-2 md:px-3 py-2 rounded-lg bg-neutral-200 text-neutral-900 text-sm border-0 focus:ring-2 focus:ring-primary-500"
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .slice(endPage)
                .map((page) => (
                  <option key={page} value={page}>
                    {page}
                  </option>
                ))}
            </select>
          )}

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-2 md:px-3 py-2 rounded-lg bg-neutral-200 text-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-300 transition-colors text-sm"
          >
            다음
          </button>
        </div>
      )}
    </Container>
  );
}
