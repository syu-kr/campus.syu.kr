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

const ITEMS_PER_PAGE = 10;
const ONE_MINUTE = 60 * 1000;
const FIVE_MINUTES = 5 * ONE_MINUTE;

interface AnnouncementListPageProps {
  category: "all" | "academic" | "campus";
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

      <SearchBar
        className="mb-6"
        defaultValue={searchQuery}
        placeholder={dictionary.pages.announcements.listSearchPlaceholder}
        onSearch={(query) => {
          setSearchQuery(query);
          setCurrentPage(1);
        }}
        onClear={() => {
          setSearchQuery("");
          setCurrentPage(1);
        }}
        searchOnChange
      />

      {!isLoading && (
        <div className="mb-4 text-sm text-neutral-600">
          {localeAwareResultCount(total, dictionary.pages.announcements.foundItems)}
          {searchQuery &&
            ` (${dictionary.pages.announcements.searchQuery}: "${searchQuery}")`}
        </div>
      )}

      <div className="mb-6 space-y-3">
        {isLoading && <Skeleton count={5} />}
        {!isLoading && announcements.length === 0 && (
          <StateCard
            type={isError ? "error" : "info"}
            message={
              isError ? errorMessage : dictionary.pages.announcements.empty
            }
          />
        )}
        {!isLoading &&
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

function localeAwareResultCount(total: number, label: string) {
  return label.startsWith("개") ? `${total}${label}` : `${total} ${label}`;
}
