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
import { StateCard } from "@/app/components/StateCard";
import { fetchCampusTips } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n";
import { usePagination } from "@/lib/use-pagination";
import type {
  CampusTip,
  CampusTipCategory,
  CampusTipContentKind,
  CampusTipSourceType,
  CampusTipVisibility,
} from "@/types";

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;
const ITEMS_PER_PAGE = 12;
type CampusTipsDictionary = Dictionary["pages"]["campusTips"];
type CampusTipViewFilter =
  | "campus-tips"
  | "essential"
  | "department"
  | "campus-life"
  | "study"
  | "external"
  | "all";

const viewFilters: CampusTipViewFilter[] = [
  "campus-tips",
  "essential",
  "department",
  "campus-life",
  "study",
  "external",
  "all",
];

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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedView, setSelectedView] =
    useState<CampusTipViewFilter>("campus-tips");
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
      .filter((tip) => matchesViewFilter(tip, selectedView))
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
          getViewLabel(selectedView, text),
          getContentKindLabel(getContentKind(tip), text),
          ...tip.tags,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchable.includes(query);
      })
      .sort((a, b) => sortTips(a, b, locale));
  }, [locale, searchQuery, selectedCategory, selectedView, text, tips]);
  const availableCategoryFilters = useMemo(() => {
    const availableCategories = new Set(
      tips
        .filter((tip) => matchesViewFilter(tip, selectedView))
        .map((tip) => tip.category),
    );

    return categoryFilters.filter(
      (category) => category === "all" || availableCategories.has(category),
    );
  }, [selectedView, tips]);
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

  const handleViewChange = (view: CampusTipViewFilter) => {
    setSelectedView(view);
    setSelectedCategory("all");
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

      <div className="mb-3 -mx-4 overflow-x-auto px-4">
        <div className="flex min-w-max gap-2 pb-1">
          {viewFilters.map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => handleViewChange(view)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                selectedView === view
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {getViewLabel(view, text)}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 -mx-4 overflow-x-auto px-4">
        <div className="flex min-w-max gap-2 pb-1">
          {availableCategoryFilters.map((category) => (
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
                      <Badge color={getContentKindBadgeColor(getContentKind(tip))}>
                        {getContentKindLabel(getContentKind(tip), text)}
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
  const visibilityDiff =
    getVisibilityPriority(getVisibility(a)) -
    getVisibilityPriority(getVisibility(b));
  if (visibilityDiff !== 0) return visibilityDiff;

  const kindDiff =
    getContentKindPriority(getContentKind(a)) -
    getContentKindPriority(getContentKind(b));
  if (kindDiff !== 0) return kindDiff;

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

function matchesViewFilter(tip: CampusTip, view: CampusTipViewFilter): boolean {
  const kind = getContentKind(tip);

  if (view === "all") return true;
  if (view === "campus-tips") return isDirectCampusTip(tip);
  if (view === "essential") {
    return (
      isDirectCampusTip(tip) &&
      (kind === "official-link" || kind === "public-link")
    );
  }
  if (view === "department") {
    return isDirectCampusTip(tip) && kind === "department-channel";
  }
  if (view === "study") return kind === "study-review";
  if (view === "external") {
    return !isDirectCampusTip(tip) && kind !== "study-review";
  }

  return (
    (isDirectCampusTip(tip) && kind === "local-life") ||
    (tip.category === "campus-life" &&
      isDirectCampusTip(tip) &&
      kind !== "study-review" &&
      kind !== "community-post" &&
      kind !== "external-directory")
  );
}

function getViewLabel(
  view: CampusTipViewFilter,
  text: CampusTipsDictionary,
): string {
  if (view === "campus-tips") return text.views.campusTips;
  if (view === "essential") return text.views.essential;
  if (view === "department") return text.views.department;
  if (view === "campus-life") return text.views.campusLife;
  if (view === "study") return text.views.study;
  if (view === "external") return text.views.external;
  return text.views.all;
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

function getContentKindLabel(
  contentKind: CampusTipContentKind,
  text: CampusTipsDictionary,
): string {
  if (contentKind === "official-link") return text.contentKinds.officialLink;
  if (contentKind === "public-link") return text.contentKinds.publicLink;
  if (contentKind === "department-channel") {
    return text.contentKinds.departmentChannel;
  }
  if (contentKind === "study-review") return text.contentKinds.studyReview;
  if (contentKind === "external-directory") {
    return text.contentKinds.externalDirectory;
  }
  if (contentKind === "community-post") return text.contentKinds.communityPost;
  return text.contentKinds.localLife;
}

function getTipPriority(tip: CampusTip): number {
  if (typeof tip.sortPriority === "number") return tip.sortPriority;
  if (tip.category === "school" && tip.id.startsWith("school-instagram-")) {
    return 900;
  }
  return 500;
}

function getVisibility(tip: CampusTip): CampusTipVisibility {
  if (tip.visibility) return tip.visibility;

  const kind = getContentKind(tip);
  if (isDirectCampusTip(tip)) return "featured";
  if (kind === "department-channel" || kind === "local-life") return "default";
  return "archive";
}

function isDirectCampusTip(tip: CampusTip): boolean {
  const kind = getContentKind(tip);

  if (
    kind === "external-directory" ||
    kind === "community-post" ||
    kind === "study-review"
  ) {
    return false;
  }

  if (
    tip.category === "activity" ||
    tip.category === "career" ||
    tip.category === "certificate"
  ) {
    return false;
  }

  if (tip.category === "finance") {
    return kind === "official-link" || kind === "public-link";
  }

  return (
    kind === "official-link" ||
    kind === "public-link" ||
    kind === "department-channel" ||
    kind === "local-life"
  );
}

function getContentKind(tip: CampusTip): CampusTipContentKind {
  if (tip.contentKind) return tip.contentKind;

  const joinedTags = tip.tags.join(" ");
  const text = `${tip.id} ${tip.title} ${joinedTags} ${tip.url}`.toLowerCase();

  if (
    tip.id.startsWith("school-instagram-") ||
    text.includes("instagram.com")
  ) {
    return "department-channel";
  }

  if (isSutoryReviewTip(tip, text)) {
    return "study-review";
  }

  if (tip.sourceType === "community" || text.includes("everytime.kr")) {
    return "community-post";
  }

  if (isExternalReferenceTip(tip, text)) {
    return "external-directory";
  }

  if (tip.category === "local" || tip.category === "culture") {
    return "local-life";
  }

  if (tip.sourceType === "official") return "official-link";
  if (tip.sourceType === "public") return "public-link";

  return "external-directory";
}

function isExternalReferenceTip(
  tip: CampusTip,
  searchableText: string,
): boolean {
  if (tip.category === "activity" || tip.category === "career") return true;

  if (
    tip.sourceType === "external" &&
    tip.category !== "local" &&
    tip.category !== "culture"
  ) {
    return true;
  }

  return [
    "linkareer.com",
    "allforyoung.com",
    "wevity.com",
    "contestkorea.com",
    "all-con.co.kr",
    "ssgsag.kr",
  ].some((domain) => searchableText.includes(domain));
}

function isSutoryReviewTip(tip: CampusTip, searchableText: string): boolean {
  if (
    searchableText.includes("sutory.syu.ac.kr/archives/") ||
    searchableText.includes("sutory.syu.ac.kr/infinity/")
  ) {
    return true;
  }

  if (!tip.id.startsWith("campus-life-sutory-")) return false;

  return [
    "advice",
    "freshman",
    "lab-tip",
    "method",
    "midterm",
    "minor",
    "plan-tip",
    "recipe",
    "review",
    "study",
    "theory",
  ].some((keyword) => tip.id.includes(keyword));
}

function getVisibilityPriority(visibility: CampusTipVisibility): number {
  if (visibility === "featured") return 0;
  if (visibility === "default") return 1;
  return 2;
}

function getContentKindPriority(contentKind: CampusTipContentKind): number {
  if (contentKind === "official-link") return 0;
  if (contentKind === "public-link") return 1;
  if (contentKind === "department-channel") return 2;
  if (contentKind === "local-life") return 3;
  if (contentKind === "study-review") return 4;
  if (contentKind === "external-directory") return 5;
  return 6;
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

function getContentKindBadgeColor(
  contentKind: CampusTipContentKind,
): "blue" | "red" | "green" | "yellow" | "purple" | "gray" {
  if (contentKind === "official-link") return "blue";
  if (contentKind === "public-link") return "green";
  if (contentKind === "department-channel") return "purple";
  if (contentKind === "study-review") return "yellow";
  if (contentKind === "external-directory") return "red";
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
