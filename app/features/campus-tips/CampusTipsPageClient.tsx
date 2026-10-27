"use client";
import { PublicContentTranslation } from "@/app/components/ContentTranslation";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/app/components/Badge";
import { Button } from "@/app/components/Button";
import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { CampusTipSuggestionForm } from "@/app/features/campus-tips/CampusTipSuggestionForm";
import {
  useDictionary,
  useLocale,
} from "@/app/components/LocaleProvider";
import { Modal } from "@/app/components/Modal";
import { PaginationControls } from "@/app/components/PaginationControls";
import { SearchBar } from "@/app/components/SearchBar";
import { SlidingIndicator } from "@/app/components/SlidingIndicator";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { fetchCampusTips } from "@/lib/api";
import { usePagination } from "@/lib/use-pagination";
import { useListSearchNavigation } from "@/lib/use-list-search-navigation";
import { useUrlHash } from "@/lib/use-url-hash";
import { filterCampusTips, getCampusTipsAvailableCategories, getViewLabel, getCategoryLabel, getSourceLabel, getContentKindLabel, getContentKind, getCategoryBadgeColor, getContentKindBadgeColor, getSourceBadgeColor } from "@/lib/campus-tip-filters";
import { campusTipViewFilters as viewFilters, getCampusTipsListQuery, type CampusTipViewFilter } from "@/lib/public-list-query";
import type {
  CampusTip,
  CampusTipCategory,
} from "@/types";

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;
const ITEMS_PER_PAGE = 12;
export default function CampusTipsPage({ initialTips }: { initialTips?: CampusTip[] } = {}) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.pages.campusTips;
  const suggestText = dictionary.pages.campusTipsSuggest;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hash = useUrlHash();
  const [isNavigating, startNavigation] = useTransition();
  const urlQuery = getCampusTipsListQuery({ search: searchParams.get("search") ?? undefined, page: searchParams.get("page") ?? undefined,
    view: searchParams.get("view") ?? undefined, category: searchParams.get("category") ?? undefined });
  const [searchQuery, setSearchQuery] = useState(urlQuery.query);
  const [selectedView, setSelectedView] =
    useState<CampusTipViewFilter>(urlQuery.view);
  const [selectedCategory, setSelectedCategory] = useState<
    CampusTipCategory | "all"
  >(urlQuery.category);
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);

  const { data: tips = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["campus-tips"],
    queryFn: () => fetchCampusTips(),
    initialData: initialTips,
    staleTime: ONE_HOUR,
    gcTime: ONE_DAY,
  });

  const availableCategoryFilters = useMemo(() => getCampusTipsAvailableCategories(tips, selectedView), [tips, selectedView]);
  const effectiveCategory = availableCategoryFilters.includes(selectedCategory) ? selectedCategory : "all";
  const filteredTips = useMemo(() => filterCampusTips(tips, { query: searchQuery, view: selectedView, category: effectiveCategory }, locale, text),
    [tips, searchQuery, selectedView, effectiveCategory, locale, text]);
  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems: paginatedTips,
    pageRange,
  } = usePagination(filteredTips, ITEMS_PER_PAGE, {
    mobilePageRange: 5,
    desktopPageRange: 7,
    initialPage: urlQuery.page,
  });



  const pageHref = (page: number, query = searchQuery, view = selectedView, category = effectiveCategory) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value, fallback] of [["search", query, ""], ["view", view, "campus-tips"], ["category", category, "all"], ["page", String(page), "1"]]) {
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
    if (!searchNavigation.pending.current) setSearchQuery(urlQuery.query);
    setSelectedView(urlQuery.view);
    setSelectedCategory(urlQuery.category);
    setCurrentPage(urlQuery.page);
  }, [urlQuery.query, urlQuery.view, urlQuery.category, urlQuery.page, isNavigating, setCurrentPage, searchNavigation.pending]);
  const changePage = (page: number) => {
    setCurrentPage(page);
    searchNavigation.cancel();
    navigate(pageHref(page));
  };

  useEffect(() => {
    if (isNavigating || isLoading || isError || searchQuery !== urlQuery.query || selectedView !== urlQuery.view || selectedCategory !== urlQuery.category) return;
    if (currentPage === urlQuery.page && effectiveCategory === urlQuery.category) return;
    const params = new URLSearchParams(searchParams.toString());
    if (currentPage > 1) params.set("page", String(currentPage)); else params.delete("page");
    if (effectiveCategory === "all") params.delete("category"); else params.set("category", effectiveCategory);
    startNavigation(() => router.replace(`${pathname}${params.size ? `?${params}` : ""}${window.location.hash}`, { scroll: false }));
  }, [isNavigating, isLoading, isError, searchQuery, selectedView, selectedCategory, urlQuery.query, urlQuery.view, urlQuery.category, urlQuery.page, currentPage, effectiveCategory, pathname, router, searchParams]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
    searchNavigation.schedule(value);
  };

  const handleViewChange = (view: CampusTipViewFilter) => {
    setSelectedView(view);
    setSelectedCategory("all");
    setCurrentPage(1);
    searchNavigation.cancel();
    navigate(pageHref(1, searchQuery, view, "all"));
  };

  const handleCategoryChange = (category: CampusTipCategory | "all") => {
    setSelectedCategory(category);
    setCurrentPage(1);
    searchNavigation.cancel();
    navigate(pageHref(1, searchQuery, selectedView, category));
  };

  const firstVisibleItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const lastVisibleItem = Math.min(
    currentPage * ITEMS_PER_PAGE,
    filteredTips.length,
  );

  return (
    <Container className="py-6 sm:py-8" onCompositionStartCapture={searchNavigation.onCompositionStartCapture} onCompositionEndCapture={searchNavigation.onCompositionEndCapture}>
      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
              {text.title}
            </h1>
            <p className="text-neutral-600">{text.description}</p>
          </div>
          <Button
            onClick={() => setIsSuggestionModalOpen(true)}
          >
            {text.suggestAction}
          </Button>
        </div>
      </div>

      <SearchBar
        className="mb-4"
        defaultValue={searchQuery}
        placeholder={text.searchPlaceholder}
        onSearch={handleSearchChange}
        onClear={() => { searchNavigation.cancel(); setSearchQuery(""); setCurrentPage(1); navigate(pageHref(1, ""), true); }}
        searchOnChange
      />

      <div className="mb-3 max-w-full overflow-x-auto">
        <div className="m3-selection-track flex min-w-max gap-2 pb-1" data-selection-tone="primary">
          <SlidingIndicator value={selectedView} />
          {viewFilters.map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => handleViewChange(view)}
              aria-pressed={selectedView === view}
              data-selection-value={view}
              className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
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

      <div className="mb-5 max-w-full overflow-x-auto">
        <div className="m3-selection-track flex min-w-max gap-2 pb-1" data-selection-tone="tonal">
          <SlidingIndicator value={effectiveCategory} />
          {availableCategoryFilters.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => handleCategoryChange(category)}
              aria-pressed={effectiveCategory === category}
              data-selection-value={category}
              className={`min-h-11 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                effectiveCategory === category
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

      {isError && (
        <StateCard
          type="error"
          className="mb-6"
          title={dictionary.home.dashboard.loadFailedTitle}
          message={dictionary.home.dashboard.loadFailedMessage}
          action={
            <Button
              onClick={() => refetch()}
            >
              {dictionary.home.dashboard.retry}
            </Button>
          }
        />
      )}

      {!isLoading && (!isError || tips.length > 0) && (
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

        {!isLoading && !isError && filteredTips.length === 0 && (
          <StateCard type="info" message={text.emptyMessage} />
        )}

        {!isLoading &&
          paginatedTips.map((tip) => {
            const contentKind = getContentKind(tip);

            return (
              <PublicContentTranslation key={tip.id} source={{ kind: "tip", id: tip.id }} content={{
                title: tip.title,
                ...(tip.description ? { description: tip.description } : {}),
                ...(tip.note ? { note: tip.note } : {}),
                ...(tip.urlLabel ? { urlLabel: tip.urlLabel } : {}),
                ...Object.fromEntries(tip.tags.map((tag, index) => [`tags.${index}`, tag])),
              }}>{translation => (
              <a
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
                        <Badge color={getContentKindBadgeColor(contentKind)}>
                          {getContentKindLabel(contentKind, text)}
                        </Badge>
                      </div>
                      <h2 lang={translation.lang} className="text-base font-bold text-neutral-900 sm:text-lg">
                        {translation.text("title", tip.title)}
                      </h2>
                      {tip.description && (
                        <p lang={translation.lang} className="mt-2 text-sm text-neutral-600">
                          {translation.text("description", tip.description)}
                        </p>
                      )}
                      {tip.note && (
                        <p lang={translation.lang} className="mt-2 text-xs text-amber-700">
                          {translation.text("note", tip.note)}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {tip.tags.map((tag, index) => (
                          <span
                            key={tag}
                            lang={translation.lang}
                            className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-600"
                          >
                            #{translation.text(`tags.${index}`, tag)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span lang={tip.urlLabel ? translation.lang : locale} className="shrink-0 text-sm font-medium text-primary-600">
                      {translation.text("urlLabel", tip.urlLabel || text.externalUrlFallback)}
                    </span>
                  </div>
                </Card>
              </a>
              )}</PublicContentTranslation>
            );
          })}
      </div>

      {!isLoading && totalPages > 1 && (
        <div className="flex flex-col items-center gap-4">
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={changePage}
            getPageHref={pageHref}
            pageRange={pageRange}
          />

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
        keepMounted
      >
        <CampusTipSuggestionForm
          idPrefix="tip-modal"
          onSuccessConfirm={() => setIsSuggestionModalOpen(false)}
        />
      </Modal>
    </Container>
  );
}
