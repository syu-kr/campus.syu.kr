"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/app/components/Badge";
import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { SearchBar } from "@/app/components/SearchBar";
import { Skeleton } from "@/app/components/Skeleton";
import { useDictionary } from "@/app/components/LocaleProvider";
import { fetchScholarships } from "@/lib/api";
import { usePagination } from "@/lib/use-pagination";

const ITEMS_PER_PAGE = 10;
const ONE_MINUTE = 60 * 1000;
const FIVE_MINUTES = 5 * ONE_MINUTE;

export default function ScholarshipPage() {
  const dictionary = useDictionary();
  const text = dictionary.pages.scholarship;
  const [searchQuery, setSearchQuery] = useState("");

  const { data: allScholarships, isLoading } = useQuery({
    queryKey: ["scholarships"],
    queryFn: () => fetchScholarships(),
    staleTime: ONE_MINUTE,
    gcTime: FIVE_MINUTES,
  });

  const filteredScholarships = useMemo(() => {
    if (!allScholarships) return [];
    if (!searchQuery.trim()) return allScholarships;

    const lowerQuery = searchQuery.toLowerCase();
    return allScholarships.filter(
      (scholarship) =>
        scholarship.name.toLowerCase().includes(lowerQuery) ||
        scholarship.description.toLowerCase().includes(lowerQuery),
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

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          {text.title}
        </h1>
        <p className="text-neutral-600">{text.description}</p>
      </div>

      <SearchBar
        className="mb-6"
        defaultValue={searchQuery}
        placeholder={text.searchPlaceholder}
        onSearch={handleSearch}
        onClear={() => handleSearch("")}
        searchOnChange
      />

      {!isLoading && (
        <div className="mb-4 text-sm text-neutral-600">
          {filteredScholarships.length}
          {text.countSeparator}
          {text.foundItems}
          {searchQuery && ` (${text.searchQuery}: "${searchQuery}")`}
        </div>
      )}

      <div className="space-y-4 mb-6">
        {isLoading && <Skeleton count={4} height="150px" />}

        {!isLoading && paginatedScholarships.length === 0 && (
          <div className="py-8 text-center text-neutral-500">
            {filteredScholarships.length === 0 ? text.emptySearch : text.empty}
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
                        {text.pinned}
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
                  <p className="text-xs text-neutral-600 mb-1">
                    {text.descriptionLabel}
                  </p>
                  <p className="text-sm text-neutral-700">
                    {scholarship.description || text.fallbackDescription}
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
                      {text.externalAction}
                    </a>
                  )}
                </div>
              </div>
            </Card>
          ))}
      </div>

      {!isLoading && totalPages > 1 && (
        <div className="flex justify-center items-center gap-1 md:gap-2 mt-8 flex-wrap">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
            className="px-2 md:px-3 py-2 rounded-lg bg-neutral-200 text-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-300 transition-colors text-sm"
          >
            {text.previous}
          </button>

          {pageNumbers.map((page) => (
            <button
              key={page}
              type="button"
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

          {totalPages > pageRange && endPage < totalPages && (
            <select
              value={currentPage}
              onChange={(event) => setCurrentPage(parseInt(event.target.value))}
              className="px-2 md:px-3 py-2 rounded-lg bg-neutral-200 text-neutral-900 text-sm border-0 focus:ring-2 focus:ring-primary-500"
            >
              {Array.from({ length: totalPages }, (_, index) => index + 1)
                .slice(endPage)
                .map((page) => (
                  <option key={page} value={page}>
                    {page}
                  </option>
                ))}
            </select>
          )}

          <button
            type="button"
            onClick={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
            }
            disabled={currentPage === totalPages}
            className="px-2 md:px-3 py-2 rounded-lg bg-neutral-200 text-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-300 transition-colors text-sm"
          >
            {text.next}
          </button>
        </div>
      )}

      <Card className="mt-8 bg-yellow-50 border border-yellow-200">
        <p className="text-sm text-yellow-900 mb-2">
          <strong>{text.importantPrefix}</strong> {text.importantMessage}
        </p>
        <p className="text-xs text-yellow-800">{text.importantDetail}</p>
      </Card>
    </Container>
  );
}
