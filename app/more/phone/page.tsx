"use client";

import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { Skeleton } from "@/app/components/Skeleton";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPhoneNumbers } from "@/lib/api";

export default function DirectoryPage() {
  const ITEMS_PER_PAGE = 10;
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: phoneData, isLoading } = useQuery({
    queryKey: ["phone-numbers"],
    queryFn: () => fetchPhoneNumbers(),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });

  // 검색 필터링
  const filteredDirectory = useMemo(() => {
    if (!phoneData) return [];
    if (!searchQuery.trim()) return phoneData;

    const lowerQuery = searchQuery.toLowerCase();
    return phoneData.filter(
      (item) =>
        item.department.toLowerCase().includes(lowerQuery) ||
        item.phone.includes(searchQuery),
    );
  }, [searchQuery, phoneData]);

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredDirectory.length / ITEMS_PER_PAGE);
  const paginatedDirectory = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    return filteredDirectory.slice(startIdx, endIdx);
  }, [filteredDirectory, currentPage]);

  // 검색어 변경 시 첫 페이지로 이동
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          연락처 검색
        </h1>
        <p className="text-neutral-600">부서 또는 전화번호로 검색하세요</p>
      </div>

      {/* 검색 바 */}
      <div className="mb-6 relative">
        <input
          type="text"
          placeholder="부서명 또는 전화번호로 검색..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full px-4 py-2 pr-10 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {searchQuery && (
          <button
            onClick={() => handleSearch("")}
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
          {filteredDirectory.length}개 항목 찾음
          {searchQuery && ` (검색어: "${searchQuery}")`}
          {filteredDirectory.length > 0 && (
            <span className="ml-2">
              - {(currentPage - 1) * ITEMS_PER_PAGE + 1} ~{" "}
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredDirectory.length)}
              개 표시
            </span>
          )}
        </div>
      )}

      {/* 연락처 목록 */}
      <div className="space-y-3">
        {isLoading && <Skeleton count={5} />}
        {!isLoading && filteredDirectory.length === 0 ? (
          <Card>
            <div className="py-8 text-center text-neutral-500">
              검색 결과가 없습니다.
            </div>
          </Card>
        ) : (
          !isLoading &&
          paginatedDirectory.map((item) => (
            <Card key={item.phone}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-neutral-900 mb-1">
                    {item.department}
                  </h3>
                  <p className="text-sm text-neutral-600">{item.phone}</p>
                </div>
                <a
                  href={`tel:${item.phone}`}
                  className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                >
                  전화
                </a>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* 페이지네이션 */}
      {!isLoading && filteredDirectory.length > ITEMS_PER_PAGE && (
        <div className="mt-8 flex flex-col items-center gap-4">
          {/* 페이지 번호 */}
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 transition-colors"
              aria-label="이전 페이지"
            >
              이전
            </button>

            {/* 페이지 번호 표시 */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const startPage = Math.max(1, currentPage - Math.floor(5 / 2));
              const pageNum = startPage + i;
              return pageNum <= totalPages ? pageNum : null;
            }).map(
              (pageNum) =>
                pageNum !== null && (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? "bg-primary-600 text-white"
                        : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                ),
            )}

            <button
              onClick={() =>
                setCurrentPage(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
              className="px-3 py-2 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 transition-colors"
              aria-label="다음 페이지"
            >
              다음
            </button>
          </div>

          {/* 페이지 정보 */}
          <p className="text-sm text-neutral-600">
            {currentPage} / {totalPages} 페이지
          </p>
        </div>
      )}

      <Card className="mt-8 bg-blue-50 border border-blue-200">
        <p className="text-sm text-blue-900">
          안내: 더 많은 전화번호는 학교 홈페이지를 참고하세요.
        </p>
      </Card>
    </Container>
  );
}
