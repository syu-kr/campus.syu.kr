"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/app/components/Badge";
import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { CampusTipSuggestionForm } from "@/app/features/campus-tips/CampusTipSuggestionForm";
import {
  useDictionary,
  useLocale,
} from "@/app/components/LocaleProvider";
import { Modal } from "@/app/components/Modal";
import { SearchBar } from "@/app/components/SearchBar";
import { Skeleton } from "@/app/components/Skeleton";
import { SourceTrustPanel } from "@/app/components/SourceTrustPanel";
import { StateCard } from "@/app/components/StateCard";
import { fetchCampusTips } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n";
import { usePagination } from "@/lib/use-pagination";
import type {
  CampusTip,
  CampusTipCategory,
  CampusTipSourceType,
} from "@/types";

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;
const ITEMS_PER_PAGE = 12;
const sourceTypes: CampusTipSourceType[] = [
  "official",
  "public",
  "external",
  "community",
];

type CampusTipsDictionary = Dictionary["pages"]["campusTips"];

const categoryFilters: Array<CampusTipCategory | "all"> = [
  "all",
  "school",
  "campus-life",
  "finance",
  "certificate",
  "activity",
  "career",
  "culture",
  "local",
  "reference",
];

const categoryOrder = new Map(
  categoryFilters.map((category, index) => [category, index]),
);

export default function CampusTipsPage() {
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.pages.campusTips;
  const suggestText = dictionary.pages.campusTipsSuggest;
  const trustText = dictionary.trust;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    CampusTipCategory | "all"
  >("all");
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);

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
          getCategoryLabel(tip.category, text),
          getSourceLabel(tip.sourceType, text),
          ...tip.tags,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchable.includes(query);
      })
      .sort((a, b) => sortTips(a, b, locale));
  }, [locale, searchQuery, selectedCategory, text, tips]);
  const sourceSummary = useMemo(
    () => formatCampusTipSourceCounts(tips, text, locale),
    [locale, text, tips],
  );

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

  const firstVisibleItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const lastVisibleItem = Math.min(
    currentPage * ITEMS_PER_PAGE,
    filteredTips.length,
  );

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
              {text.title}
            </h1>
            <p className="text-neutral-600">{text.description}</p>
          </div>
          <button
            type="button"
            onClick={() => setIsSuggestionModalOpen(true)}
            className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            {text.suggestAction}
          </button>
        </div>
      </div>

      <SearchBar
        className="mb-4"
        defaultValue={searchQuery}
        placeholder={text.searchPlaceholder}
        onSearch={handleSearchChange}
        onClear={() => handleSearchChange("")}
        searchOnChange
      />

      <div className="mb-5 -mx-4 overflow-x-auto px-4">
        <div className="flex min-w-max gap-2 pb-1">
          {categoryFilters.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => handleCategoryChange(category)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? "bg-primary-600 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {category === "all"
                ? text.categories.all
                : getCategoryLabel(category, text)}
            </button>
          ))}
        </div>
      </div>

      {!isLoading && (
        <div className="mb-4 text-sm text-neutral-600">
          {filteredTips.length}
          {text.countSeparator}
          {text.foundItems}
          {searchQuery && ` (${text.searchQuery}: "${searchQuery}")`}
          {filteredTips.length > 0 && (
            <span className="ml-2">
              - {firstVisibleItem} ~ {lastVisibleItem}
              {text.countSeparator}
              {text.showingSuffix}
            </span>
          )}
        </div>
      )}

      {!isLoading && (
        <div className="mb-4">
          <SourceTrustPanel
            badges={[
              { color: "yellow", label: trustText.unofficialBadge },
              { color: "blue", label: trustText.sourceBasedBadge },
            ]}
            description={trustText.description}
            items={[
              {
                label: trustText.serviceStatusLabel,
                value: trustText.serviceStatusValue,
              },
              {
                label: trustText.sourceLabel,
                value: sourceSummary,
              },
              {
                label: trustText.verificationLabel,
                value: trustText.officialVerificationValue,
              },
            ]}
            note={text.sourceNotice}
            title={trustText.title}
          />
        </div>
      )}

      <div className="space-y-3">
        {isLoading && <Skeleton count={6} />}

        {!isLoading && filteredTips.length === 0 && (
          <StateCard type="info" message={text.emptyMessage} />
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
                        {getCategoryLabel(tip.category, text)}
                      </Badge>
                      <Badge color={getSourceBadgeColor(tip.sourceType)}>
                        {getSourceLabel(tip.sourceType, text)}
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
                    {tip.urlLabel || text.externalUrlFallback}
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
              aria-label={text.previousPage}
            >
              {text.previous}
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
              aria-label={text.nextPage}
            >
              {text.next}
            </button>
          </div>

          <p className="text-sm text-neutral-600">
            {text.pageIndicatorPrefix}
            {currentPage} / {totalPages}
            {text.pageIndicatorSuffix}
          </p>
        </div>
      )}

      <Modal
        isOpen={isSuggestionModalOpen}
        title={suggestText.title}
        description={suggestText.description}
        onClose={() => setIsSuggestionModalOpen(false)}
        size="lg"
      >
        <CampusTipSuggestionForm
          idPrefix="tip-modal"
          onSuccessConfirm={() => setIsSuggestionModalOpen(false)}
        />
      </Modal>
    </Container>
  );
}

function sortTips(a: CampusTip, b: CampusTip, locale: string): number {
  const categoryDiff =
    (categoryOrder.get(a.category) ?? 99) -
    (categoryOrder.get(b.category) ?? 99);
  if (categoryDiff !== 0) return categoryDiff;

  const priorityDiff = getTipPriority(a) - getTipPriority(b);
  if (priorityDiff !== 0) return priorityDiff;

  const sourceDiff =
    getSourcePriority(a.sourceType) - getSourcePriority(b.sourceType);
  if (sourceDiff !== 0) return sourceDiff;

  return a.title.localeCompare(b.title, locale);
}

function getCategoryLabel(
  category: CampusTipCategory,
  text: CampusTipsDictionary,
): string {
  if (category === "school") return text.categories.school;
  if (category === "campus-life") return text.categories.campusLife;
  if (category === "finance") return text.categories.finance;
  if (category === "certificate") return text.categories.certificate;
  if (category === "activity") return text.categories.activity;
  if (category === "career") return text.categories.career;
  if (category === "culture") return text.categories.culture;
  if (category === "local") return text.categories.local;
  return text.categories.reference;
}

function getSourceLabel(
  sourceType: CampusTipSourceType,
  text: CampusTipsDictionary,
): string {
  if (sourceType === "official") return text.sources.official;
  if (sourceType === "public") return text.sources.public;
  if (sourceType === "community") return text.sources.community;
  return text.sources.external;
}

function formatCampusTipSourceCounts(
  tips: CampusTip[],
  text: CampusTipsDictionary,
  locale: string,
) {
  const countBySource = new Map<CampusTipSourceType, number>();
  tips.forEach((tip) => {
    countBySource.set(
      tip.sourceType,
      (countBySource.get(tip.sourceType) ?? 0) + 1,
    );
  });

  return sourceTypes
    .map((sourceType) =>
      applyTemplate(text.sourceCountValue, {
        count: (countBySource.get(sourceType) ?? 0).toLocaleString(locale),
        label: getSourceLabel(sourceType, text),
      }),
    )
    .join(text.sourceCountSeparator);
}

function getTipPriority(tip: CampusTip): number {
  if (typeof tip.sortPriority === "number") return tip.sortPriority;
  if (tip.category === "school" && tip.id.startsWith("school-instagram-")) {
    return 900;
  }
  return 500;
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

function applyTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  );
}
