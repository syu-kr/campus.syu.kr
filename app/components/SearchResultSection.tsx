"use client";

import Link from "next/link";

import type { CategorizedSearchResults } from "@/lib/home";
import { SearchResultCard } from "./SearchResultCard";

interface SearchResultSectionProps {
  categorizedResults: CategorizedSearchResults;
  searchQuery: string;
}

export function SearchResultSection({
  categorizedResults,
  searchQuery,
}: SearchResultSectionProps) {
  return (
    <div className="space-y-6">
      {Object.entries(categorizedResults)
        .filter(([, category]) => category.items.length > 0)
        .map(([key, category]) => (
          <div key={key} className="pb-4 border-b border-neutral-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-neutral-900">
                {category.label}{" "}
                <span className="text-sm font-medium text-neutral-500">
                  {category.items.length}
                </span>
              </h3>
              {category.items.length > 3 && (
                <Link
                  href={{
                    pathname: category.linkPath,
                    query: shouldForwardSearchQuery(key)
                      ? { search: searchQuery }
                      : undefined,
                  }}
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  전체보기 →
                </Link>
              )}
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
    </div>
  );
}

function shouldForwardSearchQuery(categoryKey: string): boolean {
  return (
    categoryKey === "academicAnnouncement" ||
    categoryKey === "campusAnnouncement" ||
    categoryKey === "scholarship"
  );
}

function getSearchResultKey(
  item: CategorizedSearchResults[string]["items"][number],
): string {
  if ("phone" in item) {
    return item.phone;
  }

  return item.id;
}
