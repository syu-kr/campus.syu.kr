"use client";

import { Container } from "@/app/components/Container";

import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { Skeleton } from "@/app/components/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { fetchScholarships } from "@/lib/api";
import { useState, useMemo } from "react";
import { usePagination } from "@/lib/use-pagination";

const ITEMS_PER_PAGE = 10;
const ONE_MINUTE = 60 * 1000;
const FIVE_MINUTES = 5 * ONE_MINUTE;

export default function ScholarshipPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: allScholarships, isLoading } = useQuery({
    queryKey: ["scholarships"],
    queryFn: () => fetchScholarships(),
    staleTime: ONE_MINUTE,
    gcTime: FIVE_MINUTES,
  });

  // 검색 필터링
  const filteredScholarships = useMemo(() => {
    if (!allScholarships) return [];
    if (!searchQuery.trim()) return allScholarships;

    const lowerQuery = searchQuery.toLowerCase();
    return allScholarships.filter(
      (s) =>
        s.name.toLowerCase().includes(lowerQuery) ||
        s.description.toLowerCase().includes(lowerQuery),
    );
  }, [allScholarships, searchQuery]);

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems: paginatedScholarships,
    pageRange,
    endPage,
    pageNumbers,
  } = usePagination(filteredScholarships, ITEMS_PER_PAGE);

  // 검색 결과가 변경되면 첫 페이지로
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          장학금
        </h1>
        <p className="text-neutral-600">교내/외 장학금 정보를 확인하세요</p>
      </div>

      {/* 검색 바 */}
      <div className="mb-6 relative">
        <input
          type="text"
          placeholder="장학금 이름 또는 설명으로 검색..."
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
          {filteredScholarships.length}개 항목 찾음
          {searchQuery && ` (검색어: "${searchQuery}")`}
        </div>
      )}

      {/* 장학금 목록 */}
      <div className="space-y-4 mb-6">
        {isLoading && <Skeleton count={4} height="150px" />}

        {!isLoading && paginatedScholarships.length === 0 && (
          <div className="py-8 text-center text-neutral-500">
            {filteredScholarships.length === 0
              ? "검색 결과가 없습니다."
              : "해당하는 장학금이 없습니다"}
          </div>
        )}

        {!isLoading &&
          paginatedScholarships &&
          paginatedScholarships.map((scholarship) => (
            <Card key={scholarship.id}>
              <div className="mb-3 flex items-start gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {scholarship.isPinned && (
                      <Badge color="red" size="sm">
                        고정글
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-neutral-900 mb-2">
                    {scholarship.name}
                  </h2>
                </div>
              </div>

              <div className="space-y-3 mt-4">
                <div>
                  <p className="text-xs text-neutral-600 mb-1">설명</p>
                  <p className="text-sm text-neutral-700">
                    {scholarship.description ||
                      "자세한 내용은 링크를 통해 확인하세요."}
                  </p>
                </div>

                <div className="pt-3 border-t border-neutral-200 flex items-center justify-between">
                  <span className="text-xs text-neutral-500">
                    {scholarship.deadline}
                  </span>
                  {scholarship.url && (
                    <a
                      href={scholarship.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      자세히 알아보기
                    </a>
                  )}
                </div>
              </div>
            </Card>
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
          {pageNumbers.map((page) => (
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

      {/* 주의사항 */}
      <Card className="mt-8 bg-yellow-50 border border-yellow-200">
        <p className="text-sm text-yellow-900 mb-2">
          <strong>중요:</strong> 장학금 신청 기간과 자격요건을 반드시
          확인하세요.
        </p>
        <p className="text-xs text-yellow-800">
          자세한 정보는 학생지원팀 또는 각 기관의 공식 안내를 참고하시기
          바랍니다.
        </p>
      </Card>
    </Container>
  );
}
