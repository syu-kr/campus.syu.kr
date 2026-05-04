"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Badge } from "@/app/components/Badge";
import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { fetchCampusTips } from "@/lib/api";
import { usePagination } from "@/lib/use-pagination";
import type {
  CampusTip,
  CampusTipCategory,
  CampusTipSourceType,
} from "@/types";

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;
const ITEMS_PER_PAGE = 12;

const categoryFilters: Array<{
  key: CampusTipCategory | "all";
  label: string;
}> = [
  { key: "all", label: "전체" },
  { key: "school", label: "학교" },
  { key: "campus-life", label: "캠퍼스생활" },
  { key: "finance", label: "금융/장학" },
  { key: "certificate", label: "자격증" },
  { key: "activity", label: "공모전/대외활동" },
  { key: "career", label: "취업" },
  { key: "culture", label: "문화생활" },
  { key: "local", label: "별내동" },
  { key: "reference", label: "참고자료" },
];

const categoryOrder = new Map(
  categoryFilters.map((category, index) => [category.key, index]),
);

const categoryLabels: Record<CampusTipCategory, string> = {
  school: "학교",
  "campus-life": "캠퍼스생활",
  finance: "금융/장학",
  certificate: "자격증",
  activity: "공모전/대외활동",
  career: "취업",
  culture: "문화생활",
  local: "별내동",
  reference: "참고자료",
};

const sourceLabels: Record<CampusTipSourceType, string> = {
  official: "공식",
  public: "공공",
  community: "커뮤니티",
  external: "외부",
};

export default function CampusTipsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    CampusTipCategory | "all"
  >("all");

  const { data: tips = [], isLoading } = useQuery({
    queryKey: ["campus-tips"],
    queryFn: () => fetchCampusTips(),
    staleTime: ONE_HOUR,
    gcTime: ONE_DAY,
  });

  const filteredTips = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return tips
      .filter((tip) =>
        selectedCategory === "all" ? true : tip.category === selectedCategory,
      )
      .filter((tip) => {
        if (!query) return true;
        const searchable = [
          tip.title,
          tip.description,
          tip.note,
          categoryLabels[tip.category],
          sourceLabels[tip.sourceType],
          ...tip.tags,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchable.includes(query);
      })
      .sort(sortTips);
  }, [searchQuery, selectedCategory, tips]);

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems: paginatedTips,
    pageNumbers,
  } = usePagination(filteredTips, ITEMS_PER_PAGE, {
    mobilePageRange: 5,
    desktopPageRange: 7,
  });

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (category: CampusTipCategory | "all") => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
              캠퍼스 꿀팁
            </h1>
            <p className="text-neutral-600">
              학교생활, 진로, 대외활동, 지역 정보를 한곳에서 찾아보세요
            </p>
          </div>
          <Link
            href="/more/campus-tips/suggest"
            className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            꿀팁 제보하기
          </Link>
        </div>
      </div>

      <div className="mb-4 relative">
        <input
          type="text"
          placeholder="수윙스, 토익, 공모전, 별내, 장학, 포트폴리오..."
          value={searchQuery}
          onChange={(event) => handleSearchChange(event.target.value)}
          className="w-full px-4 py-2 pr-10 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => handleSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1"
            aria-label="검색 초기화"
          >
            x
          </button>
        )}
      </div>

      <div className="mb-5 -mx-4 overflow-x-auto px-4">
        <div className="flex min-w-max gap-2 pb-1">
          {categoryFilters.map((category) => (
            <button
              key={category.key}
              type="button"
              onClick={() => handleCategoryChange(category.key)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                selectedCategory === category.key
                  ? "bg-primary-600 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      {!isLoading && (
        <div className="mb-4 text-sm text-neutral-600">
          {filteredTips.length}개 항목 찾음
          {searchQuery && ` (검색어: "${searchQuery}")`}
          {filteredTips.length > 0 && (
            <span className="ml-2">
              - {(currentPage - 1) * ITEMS_PER_PAGE + 1} ~{" "}
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredTips.length)}개
              표시
            </span>
          )}
        </div>
      )}

      <div className="space-y-3">
        {isLoading && <Skeleton count={6} />}

        {!isLoading && filteredTips.length === 0 && (
          <StateCard
            type="info"
            message="검색 결과가 없습니다. 다른 키워드나 카테고리를 선택해보세요."
          />
        )}

        {!isLoading &&
          paginatedTips.map((tip) => (
            <a
              key={tip.id}
              href={tip.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Card className="hover:shadow-card-hover">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge color={getCategoryBadgeColor(tip.category)}>
                        {categoryLabels[tip.category]}
                      </Badge>
                      <Badge color={getSourceBadgeColor(tip.sourceType)}>
                        {sourceLabels[tip.sourceType]}
                      </Badge>
                    </div>
                    <h2 className="text-base font-bold text-neutral-900 sm:text-lg">
                      {tip.title}
                    </h2>
                    {tip.description && (
                      <p className="mt-2 text-sm text-neutral-600">
                        {tip.description}
                      </p>
                    )}
                    {tip.note && (
                      <p className="mt-2 text-xs text-amber-700">{tip.note}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tip.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-600"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-primary-600">
                    {tip.urlLabel || "바로가기"}
                  </span>
                </div>
              </Card>
            </a>
          ))}
      </div>

      {!isLoading && totalPages > 1 && (
        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 transition-colors"
              aria-label="이전 페이지"
            >
              이전
            </button>

            {pageNumbers.map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => setCurrentPage(pageNum)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === pageNum
                    ? "bg-primary-600 text-white"
                    : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
              type="button"
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

          <p className="text-sm text-neutral-600">
            {currentPage} / {totalPages} 페이지
          </p>
        </div>
      )}
    </Container>
  );
}

function sortTips(a: CampusTip, b: CampusTip): number {
  const categoryDiff =
    (categoryOrder.get(a.category) ?? 99) -
    (categoryOrder.get(b.category) ?? 99);
  if (categoryDiff !== 0) return categoryDiff;

  const sourceDiff = getSourcePriority(a.sourceType) - getSourcePriority(b.sourceType);
  if (sourceDiff !== 0) return sourceDiff;

  return a.title.localeCompare(b.title, "ko");
}

function getSourcePriority(sourceType: CampusTipSourceType): number {
  if (sourceType === "official") return 0;
  if (sourceType === "public") return 1;
  if (sourceType === "external") return 2;
  return 3;
}

function getCategoryBadgeColor(
  category: CampusTipCategory,
): "blue" | "red" | "green" | "yellow" | "purple" | "gray" {
  if (category === "school") return "blue";
  if (category === "campus-life") return "green";
  if (category === "finance") return "yellow";
  if (category === "certificate") return "purple";
  if (category === "activity") return "red";
  return "gray";
}

function getSourceBadgeColor(
  sourceType: CampusTipSourceType,
): "blue" | "red" | "green" | "yellow" | "purple" | "gray" {
  if (sourceType === "official") return "blue";
  if (sourceType === "public") return "green";
  if (sourceType === "community") return "yellow";
  return "gray";
}
