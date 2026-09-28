"use client";

import Link from "next/link";

import type { CategorizedSearchResults } from "@/lib/home";
import { useDictionary } from "@/app/components/LocaleProvider";
import { SearchResultCard } from "./SearchResultCard";

interface SearchResultSectionProps {
  categorizedResults: CategorizedSearchResults;
  searchQuery: string;
}

export function SearchResultSection({
  categorizedResults,
  searchQuery,
}: SearchResultSectionProps) {
  const dictionary = useDictionary();

  return (
    <div className="space-y-6">
      {Object.entries(categorizedResults)
        .filter(([, category]) => category.items.length > 0)
        .map(([key, category]) => (
          <div key={key} className="pb-4 border-b border-neutral-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-neutral-900">
                {category.label}{" "}
                <span className="text-sm font-medium text-neutral-500">
                  {category.items.length} {dictionary.search.previewLabel}
                </span>
              </h2>
              <Link
                href={{
                  pathname: category.linkPath,
                  query: { search: searchQuery },
                }}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                {dictionary.search.viewAll} →
              </Link>
            </div>

            <div className="space-y-2">
              {category.items.slice(0, 3).map((item) => (
                <SearchResultCard
                  key={getSearchResultKey(item)}
                  item={item}
                  query={searchQuery}
                />
              ))}
            </div>
          </div>
        ))}
      {Object.entries(categorizedResults).some(([, category]) => category.items.length === 0) && (
        <nav aria-label={dictionary.search.otherCategories} className="flex flex-wrap gap-2">
          {Object.entries(categorizedResults)
            .filter(([, category]) => category.items.length === 0)
            .map(([key, category]) => (
              <Link
                key={key}
                href={{ pathname: category.linkPath, query: { search: searchQuery } }}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-xs text-neutral-700 hover:border-primary-300 hover:text-primary-700"
              >
                {category.label} {dictionary.search.viewAll} →
              </Link>
            ))}
        </nav>
      )}
    </div>
  );
}

function getSearchResultKey(
  item: CategorizedSearchResults[string]["items"][number],
): string {
  if ("phone" in item) {
    return `${item.department}-${item.phone}`;
  }

  return item.id;
}
