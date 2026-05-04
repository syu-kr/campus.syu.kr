"use client";

import { ChangeEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnnouncementCard } from "@/app/components/AnnouncementCard";
import { Container } from "@/app/components/Container";
import { PaginationControls } from "@/app/components/PaginationControls";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { fetchAnnouncementPage } from "@/lib/api";

const ITEMS_PER_PAGE = 10;
const ONE_MINUTE = 60 * 1000;
const FIVE_MINUTES = 5 * ONE_MINUTE;

interface AnnouncementListPageProps {
  category: "academic" | "campus";
  title: string;
  description: string;
  errorMessage: string;
}

export function AnnouncementListPage({
  category,
  title,
  description,
  errorMessage,
}: AnnouncementListPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["announcement-page", category, searchQuery, currentPage],
    queryFn: () =>
      fetchAnnouncementPage({
        category,
        query: searchQuery,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      }),
    staleTime: searchQuery ? 0 : ONE_MINUTE,
    gcTime: FIVE_MINUTES,
  });

  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
    setCurrentPage(1);
  };

  const announcements = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-neutral-900 sm:text-3xl">
          {title}
        </h1>
        <p className="text-neutral-600">{description}</p>
      </div>

      <div className="relative mb-6">
        <input
          type="text"
          placeholder="제목 또는 작성자로 검색..."
          value={searchQuery}
          onChange={handleSearch}
          className="w-full rounded-lg border border-neutral-300 px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setCurrentPage(1);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-400 transition-colors hover:text-neutral-600"
            aria-label="검색 초기화"
          >
            x
          </button>
        )}
      </div>

      {!isLoading && (
        <div className="mb-4 text-sm text-neutral-600">
          {total}개 항목 찾음
          {searchQuery && ` (검색어: "${searchQuery}")`}
        </div>
      )}

      <div className="mb-6 space-y-3">
        {isLoading && <Skeleton count={5} />}
        {!isLoading && announcements.length === 0 && (
          <StateCard
            type={isError ? "error" : "info"}
            message={isError ? errorMessage : "검색 결과가 없습니다."}
          />
        )}
        {!isLoading &&
          announcements.map((announcement) => (
            <div key={announcement.id} className="mb-2">
              <AnnouncementCard
                announcement={announcement}
                href={announcement.url}
                external
              />
            </div>
          ))}
      </div>

      {!isLoading && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </Container>
  );
}
