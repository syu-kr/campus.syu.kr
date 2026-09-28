"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnnouncementCard } from "@/app/components/AnnouncementCard";
import { Container } from "@/app/components/Container";
import { PaginationControls } from "@/app/components/PaginationControls";
import { SearchBar } from "@/app/components/SearchBar";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { useDictionary } from "@/app/components/LocaleProvider";
import { fetchAnnouncementPage } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useUrlSearch } from "@/lib/use-url-search";
import type { AnnouncementCategory } from "@/types";

const ITEMS_PER_PAGE = 10;
const ONE_MINUTE = 60 * 1000;
const FIVE_MINUTES = 5 * ONE_MINUTE;

interface AnnouncementListPageProps {
  category: AnnouncementCategory | "all";
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
  const dictionary = useDictionary();
  const [inputQuery, setInputQuery] = useUrlSearch();
  const searchQuery = useDebouncedValue(inputQuery);
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["announcement-page", category, searchQuery, currentPage],
    queryFn: ({ signal }) =>
      fetchAnnouncementPage({
        category,
        query: searchQuery,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        signal,
      }),
    staleTime: searchQuery ? 0 : ONE_MINUTE,
    gcTime: FIVE_MINUTES,
  });

  const announcements = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const showLoading = isLoading || inputQuery !== searchQuery;

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-neutral-900 sm:text-3xl">
          {title}
        </h1>
        <p className="text-neutral-600">{description}</p>
      </div>

      <SearchBar
        className="mb-6"
        defaultValue={inputQuery}
        placeholder={dictionary.pages.announcements.listSearchPlaceholder}
        onSearch={(query) => {
          setInputQuery(query);
          setCurrentPage(1);
        }}
        onClear={() => {
          setInputQuery("");
          setCurrentPage(1);
        }}
        searchOnChange
      />

      {!showLoading && !isError && Boolean(data?.fallbackSources?.length) && (
        <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {dictionary.pages.announcements.fallbackNotice}{" "}
          {data?.fallbackSources?.map(({ category: source, latestDate }) =>
            `${dictionary.pages.announcements.fallbackCategories[source]}: ${latestDate || "?"}`,
          ).join(", ")}
        </p>
      )}

      {!showLoading && !isError && (
        <div className="mb-4 text-sm text-neutral-600">
          {localeAwareResultCount(total, dictionary.pages.announcements.foundItems)}
          {searchQuery &&
            ` (${dictionary.pages.announcements.searchQuery}: "${searchQuery}")`}
        </div>
      )}

      <div className="mb-6 space-y-3">
        {showLoading && <Skeleton count={5} />}
        {!showLoading && (isError || announcements.length === 0) && (
          <StateCard
            type={isError ? "error" : "info"}
            message={
              isError ? errorMessage : dictionary.pages.announcements.empty
            }
          />
        )}
        {!showLoading &&
          announcements.map((announcement) => (
            <div key={announcement.id} className="mb-2">
              <AnnouncementCard
                announcement={announcement}
                href={announcement.url}
                external={Boolean(announcement.url)}
              />
            </div>
          ))}
      </div>

      {!showLoading && !isError && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </Container>
  );
}

function localeAwareResultCount(total: number, label: string) {
  return label.startsWith("개") ? `${total}${label}` : `${total} ${label}`;
}
