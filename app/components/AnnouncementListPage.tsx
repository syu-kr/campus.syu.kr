"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AnnouncementCard } from "@/app/components/AnnouncementCard";
import { Container } from "@/app/components/Container";
import { CrawlDataStatus } from "@/app/components/CrawlDataStatus";
import { PaginationControls } from "@/app/components/PaginationControls";
import { SearchBar } from "@/app/components/SearchBar";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { useDictionary } from "@/app/components/LocaleProvider";
import { fetchAnnouncementPage, type AnnouncementPageResponse } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { getAnnouncementListQuery } from "@/lib/announcement-list-query";
import type { DailyCrawlDataFile } from "@/lib/crawl-data-contract";
import type { AnnouncementCategory } from "@/types";

const ITEMS_PER_PAGE = 10;
const ONE_MINUTE = 60 * 1000;
const FIVE_MINUTES = 5 * ONE_MINUTE;
const SOURCE_FILES: Record<AnnouncementCategory, DailyCrawlDataFile> = {
  academic: "announcements-academic.json",
  campus: "announcements-campus-life.json",
  scholarship: "announcements-scholarship.json",
  sw: "announcements-sw.json",
};

interface AnnouncementListPageProps {
  category: AnnouncementCategory | "all";
  title: string;
  description: string;
  errorMessage: string;
  initialPage?: AnnouncementPageResponse;
  initialQuery?: string;
}

export function AnnouncementListPage({
  category,
  title,
  description,
  errorMessage,
  initialPage,
  initialQuery = "",
}: AnnouncementListPageProps) {
  const dictionary = useDictionary();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isNavigating, startNavigation] = useTransition();
  const { query: urlQuery, page: urlPage } = getAnnouncementListQuery({
    search: searchParams.get("search") ?? undefined,
    page: searchParams.get("page") ?? undefined,
  });
  const [inputQuery, setInputQuery] = useState(urlQuery);
  const searchQuery = useDebouncedValue(inputQuery);
  const [currentPage, setCurrentPage] = useState(urlPage);

  useEffect(() => {
    if (isNavigating) return;
    setInputQuery(urlQuery);
    setCurrentPage(urlPage);
  }, [urlQuery, urlPage, isNavigating]);

  const pageHref = (page: number, query = inputQuery) => {
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) params.set("search", query);
    else params.delete("search");
    if (page > 1) params.set("page", String(page));
    else params.delete("page");
    return `${pathname}${params.size ? `?${params}` : ""}`;
  };
  const changePage = (page: number) => {
    setCurrentPage(page);
    startNavigation(() => router.push(`${pageHref(page)}${window.location.hash}`, { scroll: false }));
  };
  const changeSearch = (query: string) => {
    setInputQuery(query);
    setCurrentPage(1);
    startNavigation(() => router.replace(`${pageHref(1, query)}${window.location.hash}`, { scroll: false }));
  };

  // The RSC navigation returns the requested data and metadata together. Use that
  // exact snapshot; callers without server data retain the existing API fallback.
  const hasServerPage = initialPage?.page === currentPage && initialQuery === searchQuery && inputQuery === searchQuery;
  const isUrlCurrent = urlPage === currentPage && urlQuery === searchQuery;

  const { data: browserData, isLoading: browserLoading, isError: browserError } = useQuery({
    queryKey: ["announcement-page", category, searchQuery, currentPage],
    queryFn: ({ signal }) =>
      fetchAnnouncementPage({
        category,
        query: searchQuery,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        signal,
      }),
    initialData: hasServerPage ? initialPage : undefined,
    enabled: !hasServerPage && !isNavigating && isUrlCurrent && inputQuery === searchQuery,
    staleTime: searchQuery ? 0 : ONE_MINUTE,
    gcTime: FIVE_MINUTES,
  });

  const data = hasServerPage ? initialPage : browserData;
  const isLoading = !hasServerPage && browserLoading;
  const isError = !hasServerPage && browserError;
  const announcements = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const showLoading = isLoading || isNavigating || !isUrlCurrent || inputQuery !== searchQuery;

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
        onSearch={changeSearch}
        onClear={() => changeSearch("")}
        searchOnChange
      />

      <CrawlDataStatus
        fileNames={category === "all" ? Object.values(SOURCE_FILES) : [SOURCE_FILES[category]]}
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

      <div className="notice-workspace-layout">
      <div className="notice-workspace-list mb-6 space-y-3">
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
      </div>

      {!showLoading && !isError && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={changePage}
          getPageHref={pageHref}
        />
      )}
    </Container>
  );
}

function localeAwareResultCount(total: number, label: string) {
  return label.startsWith("개") ? `${total}${label}` : `${total} ${label}`;
}
