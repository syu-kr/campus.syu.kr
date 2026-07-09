"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/app/components/Badge";
import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { PaginationControls } from "@/app/components/PaginationControls";
import { SearchBar } from "@/app/components/SearchBar";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { useDictionary } from "@/app/components/LocaleProvider";
import { AnnouncementAiSummary } from "@/app/components/AnnouncementAiSummary";
import { fetchCompetitionPage } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n";
import { formatDateWithYear } from "@/lib/utils";
import type {
  CompetitionAnnouncement,
  CompetitionKind,
  CompetitionSourceCategory,
  CompetitionSourceFilter,
  CompetitionStatus,
  CompetitionStatusFilter,
} from "@/types";

const ITEMS_PER_PAGE = 10;
const ONE_MINUTE = 60 * 1000;
const FIVE_MINUTES = 5 * ONE_MINUTE;
const statusFilters: CompetitionStatusFilter[] = [
  "open",
  "result",
  "closed",
  "all",
];
const sourceFilters: CompetitionSourceFilter[] = [
  "all",
  "event",
  "department",
  "academic",
  "campus",
  "scholarship",
];

type CompetitionsDictionary = Dictionary["pages"]["competitions"];

export function CompetitionsPageClient() {
  const dictionary = useDictionary();
  const text = dictionary.pages.competitions;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] =
    useState<CompetitionStatusFilter>("open");
  const [selectedSource, setSelectedSource] =
    useState<CompetitionSourceFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "competition-page",
      selectedSource,
      selectedStatus,
      searchQuery,
      currentPage,
    ],
    queryFn: () =>
      fetchCompetitionPage({
        source: selectedSource,
        status: selectedStatus,
        query: searchQuery,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      }),
    staleTime: searchQuery ? 0 : ONE_MINUTE,
    gcTime: FIVE_MINUTES,
  });

  const competitions = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const handleStatusChange = (status: CompetitionStatusFilter) => {
    setSelectedStatus(status);
    setCurrentPage(1);
  };

  const handleSourceChange = (source: CompetitionSourceFilter) => {
    setSelectedSource(source);
    setCurrentPage(1);
  };

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-neutral-900 sm:text-3xl">
          {text.title}
        </h1>
        <p className="text-neutral-600">{text.description}</p>
        <p className="mt-2 text-sm text-neutral-500">{text.sourceNotice}</p>
      </div>

      <SearchBar
        className="mb-5"
        defaultValue={searchQuery}
        placeholder={text.searchPlaceholder}
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

      {!isLoading && !isError && (
        <div className="mb-4 text-sm text-neutral-600">
          {`${total}${text.countSeparator}${text.foundItems}`}
          {searchQuery && ` (${text.searchQuery}: "${searchQuery}")`}
        </div>
      )}

      <div className="mb-6 space-y-3">
        {isLoading && <Skeleton count={5} />}
        {!isLoading && (isError || competitions.length === 0) && (
          <StateCard
            type={isError ? "error" : "info"}
            message={isError ? text.error : text.empty}
          />
        )}
        {!isLoading &&
          competitions.map((competition) => (
            <CompetitionCard
              key={`${competition.sourceCategory}-${competition.id}`}
              competition={competition}
              text={text}
            />
          ))}
      </div>

      {!isLoading && !isError && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </Container>
  );
}

interface FilterRowProps<T extends string> {
  filters: T[];
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
      <div className="flex min-w-max gap-2 pb-1">
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => onChange(filter)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
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
  const overlayLabel = `${competition.title} ${text.originalLink}`;
  const preview = competition.content.trim().replace(/\s+/g, " ");
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
        <h2 className="text-base font-semibold text-neutral-900 sm:text-lg">
          {competition.title}
        </h2>
        {preview && (
          <p className="line-clamp-2 text-sm leading-6 text-neutral-600">
            {preview}
          </p>
        )}
        {competition.aiSummary?.summary && (
          <AnnouncementAiSummary
            aiSummary={competition.aiSummary}
            variant="preview"
          />
        )}
        <div className="flex items-center justify-between border-t border-neutral-100 pt-2 text-xs text-neutral-500">
          <span>{formatDateWithYear(competition.date)}</span>
          <span className="ml-3 truncate text-right">{authorLabel}</span>
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
