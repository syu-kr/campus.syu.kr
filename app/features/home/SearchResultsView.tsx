import { Container } from "@/app/components/Container";
import { SearchBar } from "@/app/components/SearchBar";
import { SearchResultSection } from "@/app/components/SearchResultSection";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { useDictionary } from "@/app/components/LocaleProvider";
import type { CategorizedSearchResults, HomeSearchResult } from "@/lib/home";

interface SearchResultsViewProps {
  searchQuery: string;
  searchResults?: HomeSearchResult[];
  categorizedResults: CategorizedSearchResults;
  isLoading: boolean;
  onSearch: (query: string) => void;
  onClear: () => void;
}

export function SearchResultsView({
  searchQuery,
  searchResults,
  categorizedResults,
  isLoading,
  onSearch,
  onClear,
}: SearchResultsViewProps) {
  const dictionary = useDictionary();

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-6 space-y-3">
        <SearchBar
          onSearch={onSearch}
          onClear={onClear}
          defaultValue={searchQuery}
          placeholder={dictionary.search.compactPlaceholder}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-neutral-600">
            <span className="font-semibold text-neutral-900">
              &quot;{searchQuery}&quot;
            </span>{" "}
            {dictionary.search.resultSuffix}
          </p>
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            {dictionary.search.resetToHome}
          </button>
        </div>
      </div>

      {isLoading && (
        <div>
          <Skeleton count={3} />
        </div>
      )}

      {!isLoading && (!searchResults || searchResults.length === 0) && (
        <StateCard
          type="info"
          title={dictionary.search.noResultsTitle}
          message={`"${searchQuery}" ${dictionary.search.noResultsMessage}`}
          action={
            <button
              type="button"
              onClick={onClear}
              className="inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            >
              {dictionary.search.cancel}
            </button>
          }
        />
      )}

      {!isLoading && searchResults && searchResults.length > 0 && (
        <SearchResultSection
          categorizedResults={categorizedResults}
          searchQuery={searchQuery}
        />
      )}
    </Container>
  );
}
