"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/app/components/Badge";
import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { PaginationControls } from "@/app/components/PaginationControls";
import { SearchBar } from "@/app/components/SearchBar";
import { SlidingIndicator } from "@/app/components/SlidingIndicator";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { useDictionary } from "@/app/components/LocaleProvider";
import { AnnouncementAiSummary } from "@/app/components/AnnouncementAiSummary";
import { useContentTranslation } from "@/app/components/ContentTranslation";
import { announcementTranslationFields, splitPublicContentText } from "@/lib/content-translation";
import { fetchCompetitionPage } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useListSearchNavigation } from "@/lib/use-list-search-navigation";
import { useUrlHash } from "@/lib/use-url-hash";
import type { Dictionary } from "@/lib/i18n";
import { formatDateWithYear } from "@/lib/utils";
import { competitionSourceFilters as sourceFilters, competitionStatusFilters as statusFilters, getCompetitionListQuery } from "@/lib/public-list-query";
import type {
  CompetitionAnnouncement,
  CompetitionKind,
  CompetitionSourceCategory,
  CompetitionSourceFilter,
  CompetitionStatus,
  CompetitionStatusFilter,
  CompetitionPageResponse,
} from "@/types";

const ITEMS_PER_PAGE = 10;
const ONE_MINUTE = 60 * 1000;
const FIVE_MINUTES = 5 * ONE_MINUTE;
type CompetitionsDictionary = Dictionary["pages"]["competitions"];

export function CompetitionsPageClient({ initialPage, initialQuery = getCompetitionListQuery({}) }: {
  initialPage?: CompetitionPageResponse;
  initialQuery?: ReturnType<typeof getCompetitionListQuery>;
} = {}) {
  const dictionary = useDictionary();
  const text = dictionary.pages.competitions;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hash = useUrlHash();
  const [isNavigating, startNavigation] = useTransition();
  const urlQuery = getCompetitionListQuery({ search: searchParams.get("search") ?? undefined, page: searchParams.get("page") ?? undefined,
    source: searchParams.get("source") ?? undefined, status: searchParams.get("status") ?? undefined });
  const [inputQuery, setInputQuery] = useState(urlQuery.query);
  const searchQuery = useDebouncedValue(inputQuery);
  const [selectedStatus, setSelectedStatus] =
    useState<CompetitionStatusFilter>(urlQuery.status);
  const [selectedSource, setSelectedSource] =
    useState<CompetitionSourceFilter>(urlQuery.source);
  const [currentPage, setCurrentPage] = useState(urlQuery.page);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [pageLoadingHeight, setPageLoadingHeight] = useState(0);



  const pageHref = (page: number, query = inputQuery, status = selectedStatus, source = selectedSource) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value, fallback] of [["search", query, ""], ["status", status, "open"], ["source", source, "all"], ["page", String(page), "1"]]) {
      if (value === fallback || (key === "search" && !value.trim())) params.delete(key);
      else params.set(key, value);
    }
    return `${pathname}${params.size ? `?${params}` : ""}${hash}`;
  };
  const navigate = (href: string, replace = false) => startNavigation(() =>
    router[replace ? "replace" : "push"](href, { scroll: false }));
  const searchNavigation = useListSearchNavigation(query => navigate(pageHref(1, query), true));

  useEffect(() => {
    if (isNavigating) return;
    if (!searchNavigation.pending.current) setInputQuery(urlQuery.query);
    setSelectedStatus(urlQuery.status);
    setSelectedSource(urlQuery.source);
    setCurrentPage(urlQuery.page);
  }, [urlQuery.query, urlQuery.status, urlQuery.source, urlQuery.page, isNavigating, searchNavigation.pending]);
  const isUrlCurrent = urlQuery.query === searchQuery && urlQuery.source === selectedSource &&
    urlQuery.status === selectedStatus && urlQuery.page === currentPage;
  const hasServerPage = initialPage?.page === currentPage && initialQuery.query === searchQuery &&
    initialQuery.source === selectedSource && initialQuery.status === selectedStatus && inputQuery === searchQuery;

  const { data: browserData, isLoading: browserLoading, isError: browserError, isPlaceholderData = false } = useQuery({
    queryKey: [
      "competition-page",
      selectedSource,
      selectedStatus,
      searchQuery,
      currentPage,
    ],
    queryFn: ({ signal }) =>
      fetchCompetitionPage({
        source: selectedSource,
        status: selectedStatus,
        query: searchQuery,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        signal,
      }),
    initialData: hasServerPage ? initialPage : undefined,
    placeholderData: (previous, previousQuery) => inputQuery === searchQuery &&
      previousQuery?.queryKey[0] === "competition-page" &&
      previousQuery.queryKey[1] === selectedSource && previousQuery.queryKey[2] === selectedStatus &&
      previousQuery.queryKey[3] === searchQuery && previousQuery.queryKey[4] !== currentPage ? previous : undefined,
    enabled: !hasServerPage && !isNavigating && isUrlCurrent && inputQuery === searchQuery,
    staleTime: searchQuery ? 0 : ONE_MINUTE,
    gcTime: FIVE_MINUTES,
  });

  const data = hasServerPage ? initialPage : browserData;
  const isLoading = !hasServerPage && browserLoading;
  const isError = !hasServerPage && browserError;
  const competitions = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const showLoading = isLoading || (!hasServerPage && isPlaceholderData) || isNavigating || !isUrlCurrent || inputQuery !== searchQuery;
  const keepingPreviousPage = pageLoadingHeight > 0 && inputQuery === searchQuery && !isError &&
    ((!hasServerPage && isPlaceholderData) || isNavigating);

  const handlePageChange = (page: number) => {
    setPageLoadingHeight(resultsRef.current?.getBoundingClientRect().height ?? 0);
    setCurrentPage(page);
    searchNavigation.cancel();
    navigate(pageHref(page));
  };

  const handleStatusChange = (status: CompetitionStatusFilter) => {
    setSelectedStatus(status);
    setCurrentPage(1);
    setPageLoadingHeight(0);
    searchNavigation.cancel();
    navigate(pageHref(1, inputQuery, status));
  };

  const handleSourceChange = (source: CompetitionSourceFilter) => {
    setSelectedSource(source);
    setCurrentPage(1);
    setPageLoadingHeight(0);
    searchNavigation.cancel();
    navigate(pageHref(1, inputQuery, selectedStatus, source));
  };

  return (
    <Container className="py-6 sm:py-8" onCompositionStartCapture={searchNavigation.onCompositionStartCapture} onCompositionEndCapture={searchNavigation.onCompositionEndCapture}>
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-neutral-900 sm:text-3xl">
          {text.title}
        </h1>
        <p className="text-neutral-600">{text.description}</p>
        <p className="mt-2 text-sm text-neutral-500">{text.sourceNotice}</p>
      </div>

      <SearchBar
        className="mb-5"
        defaultValue={inputQuery}
        placeholder={text.searchPlaceholder}
        onSearch={(query) => {
          setInputQuery(query);
          setCurrentPage(1);
          setPageLoadingHeight(0);
          searchNavigation.schedule(query);
        }}
        onClear={() => {
          setInputQuery("");
          setCurrentPage(1);
          setPageLoadingHeight(0);
          searchNavigation.cancel();
          navigate(pageHref(1, ""), true);
        }}
        searchOnChange
      />

      <FilterRow
        filters={statusFilters}
        selected={selectedStatus}
        getLabel={(status) => getStatusFilterLabel(status, text)}
        onChange={handleStatusChange}
      />

      <FilterRow
        className="mb-5"
        filters={sourceFilters}
        selected={selectedSource}
        getLabel={(source) => getSourceFilterLabel(source, text)}
        onChange={handleSourceChange}
        secondary
      />

      {(!showLoading || keepingPreviousPage) && !isError && (
        <div className="mb-4 text-sm text-neutral-600">
          {`${total}${text.countSeparator}${text.foundItems}`}
          {searchQuery && ` (${text.searchQuery}: "${searchQuery}")`}
        </div>
      )}

      <div ref={resultsRef} className="mb-6 space-y-3"
        style={keepingPreviousPage && !isError ? { minHeight: pageLoadingHeight } : undefined}>
        {showLoading && <Skeleton count={5} />}
        {!showLoading && (isError || competitions.length === 0) && (
          <StateCard
            type={isError ? "error" : "info"}
            message={isError ? text.error : text.empty}
          />
        )}
        {!showLoading &&
          competitions.map((competition) => (
            <CompetitionCard
              key={`${competition.sourceCategory}-${competition.id}`}
              competition={competition}
              text={text}
            />
          ))}
      </div>

      {(!showLoading || keepingPreviousPage) && !isError && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          getPageHref={pageHref}
        />
      )}
    </Container>
  );
}

interface FilterRowProps<T extends string> {
  filters: readonly T[];
  selected: T;
  getLabel: (filter: T) => string;
  onChange: (filter: T) => void;
  className?: string;
  secondary?: boolean;
}

function FilterRow<T extends string>({
  filters,
  selected,
  getLabel,
  onChange,
  className = "mb-3",
  secondary = false,
}: FilterRowProps<T>) {
  return (
    <div className={`-mx-4 overflow-x-auto px-4 ${className}`}>
      <div className="m3-selection-track flex min-w-max gap-2 pb-1" data-selection-tone={secondary ? "tonal" : "primary"}>
        <SlidingIndicator value={selected} />
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => onChange(filter)}
            aria-pressed={selected === filter}
            data-selection-value={filter}
            className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              selected === filter
                ? secondary
                  ? "bg-primary-600 text-white"
                  : "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            {getLabel(filter)}
          </button>
        ))}
      </div>
    </div>
  );
}

function CompetitionCard({
  competition,
  text,
}: {
  competition: CompetitionAnnouncement;
  text: CompetitionsDictionary;
}) {
  const href = competition.url;
  const firstPart = splitPublicContentText(competition.content)[0];
  const translation = useContentTranslation({ kind: "competition", id: competition.id, category: competition.sourceCategory }, { ...announcementTranslationFields(competition), ...(firstPart ? { "contentParts.0": firstPart } : {}) });
  const overlayLabel = `${translation.text("title", competition.title)} ${text.originalLink}`;
  const preview = translation.text("contentParts.0", firstPart ?? "").trim().replace(/\s+/g, " ");
  const authorLabel =
    competition.sourceName || competition.author || text.defaultAuthor;

  return (
    <Card
      as="article"
      clickable={Boolean(href)}
      className={href ? "relative" : ""}
    >
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 z-10 rounded-card focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          aria-label={overlayLabel}
        >
          <span className="sr-only">{overlayLabel}</span>
        </a>
      )}
      <div
        className={
          href
            ? "pointer-events-none relative z-20 flex flex-col gap-3"
            : "flex flex-col gap-3"
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={getSourceColor(competition.sourceCategory)} size="sm">
            {getSourceFilterLabel(competition.sourceCategory, text)}
          </Badge>
          <Badge color={getStatusColor(competition.competitionStatus)} size="sm">
            {getStatusLabel(competition.competitionStatus, text)}
          </Badge>
          <Badge color={getKindColor(competition.competitionKind)} size="sm">
            {getKindLabel(competition.competitionKind, text)}
          </Badge>
        </div>
        <h2 lang={translation.lang} className="text-base font-semibold text-neutral-900 sm:text-lg">
          {translation.text("title", competition.title)}
        </h2>
        {preview && (
          <p lang={translation.lang} className="line-clamp-2 text-sm leading-6 text-neutral-600">
            {preview}
          </p>
        )}
        {competition.aiSummary?.summary && (
          <AnnouncementAiSummary
            aiSummary={competition.aiSummary}
            translation={translation}
          />
        )}
        <div className="flex items-center justify-between border-t border-neutral-100 pt-2 text-xs text-neutral-500">
          <span>{formatDateWithYear(competition.date)}</span>
          <span lang="ko" translate="no" className="ml-3 truncate text-right">{authorLabel}</span>
        </div>
      </div>
    </Card>
  );
}

function getStatusFilterLabel(
  status: CompetitionStatusFilter,
  text: CompetitionsDictionary,
): string {
  if (status === "all") return text.statusFilters.all;
  return getStatusLabel(status, text);
}

function getStatusLabel(
  status: CompetitionStatus,
  text: CompetitionsDictionary,
): string {
  if (status === "open") return text.statuses.open;
  if (status === "result") return text.statuses.result;
  return text.statuses.closed;
}

function getSourceFilterLabel(
  source: CompetitionSourceFilter,
  text: CompetitionsDictionary,
): string {
  if (source === "all") return text.sourceFilters.all;
  if (source === "event") return text.sourceFilters.event;
  if (source === "department") return text.sourceFilters.department;
  if (source === "academic") return text.sourceFilters.academic;
  if (source === "campus") return text.sourceFilters.campus;
  return text.sourceFilters.scholarship;
}

function getKindLabel(
  kind: CompetitionKind,
  text: CompetitionsDictionary,
): string {
  if (kind === "competition") return text.kinds.competition;
  if (kind === "hackathon") return text.kinds.hackathon;
  if (kind === "idea") return text.kinds.idea;
  if (kind === "capstone") return text.kinds.capstone;
  if (kind === "presentation") return text.kinds.presentation;
  if (kind === "program") return text.kinds.program;
  return text.kinds.contest;
}

function getSourceColor(
  source: CompetitionSourceCategory,
): "blue" | "red" | "green" | "yellow" | "purple" | "gray" {
  if (source === "event") return "purple";
  if (source === "department") return "red";
  if (source === "academic") return "blue";
  if (source === "campus") return "green";
  if (source === "scholarship") return "yellow";
  return "gray";
}

function getStatusColor(
  status: CompetitionStatus,
): "blue" | "red" | "green" | "yellow" | "purple" | "gray" {
  if (status === "open") return "green";
  if (status === "result") return "blue";
  return "gray";
}

function getKindColor(
  kind: CompetitionKind,
): "blue" | "red" | "green" | "yellow" | "purple" | "gray" {
  if (kind === "hackathon") return "red";
  if (kind === "idea") return "purple";
  if (kind === "capstone") return "yellow";
  if (kind === "presentation") return "green";
  if (kind === "program") return "gray";
  return "blue";
}
