import { Container } from "@/app/components/Container";
import { SearchBar } from "@/app/components/SearchBar";
import { SearchResultSection } from "@/app/components/SearchResultSection";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { useDictionary } from "@/app/components/LocaleProvider";
import { Button } from "@/app/components/Button";
import type { SearchSource } from "@/lib/api";
import type { CategorizedSearchResults, HomeSearchResult } from "@/lib/home";

interface SearchResultsViewProps {
  searchQuery: string;
  searchResults?: HomeSearchResult[];
  failedSources: SearchSource[];
  categorizedResults: CategorizedSearchResults;
  isLoading: boolean;
  isError: boolean;
  onSearch: (query: string) => void;
  onClear: () => void;
  onRetry: () => void;
}

export function SearchResultsView({
  searchQuery,
  searchResults,
  failedSources,
  categorizedResults,
  isLoading,
  isError,
  onSearch,
  onClear,
  onRetry,
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
          <h1 className="text-lg font-semibold text-neutral-900">
            <span className="font-semibold text-neutral-900">
              &quot;{searchQuery}&quot;
            </span>{" "}
            {dictionary.search.resultSuffix}
          </h1>
          <Button
            variant="secondary"
            type="button"
            onClick={onClear}
          >
            {dictionary.search.resetToHome}
          </Button>
        </div>
      </div>

      {!isLoading && !isError && failedSources.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
          <p>
            {dictionary.search.partialFailure}{" "}
            {failedSources.map((source) => dictionary.search.searchSources[source]).join(", ")}
          </p>
          {(!searchResults || searchResults.length === 0) && (
            <p className="mt-1">{dictionary.search.partialNoResults}</p>
          )}
          <Button variant="secondary" onClick={onRetry} className="mt-2">
            {dictionary.search.retry}
          </Button>
        </div>
      )}

      {!isLoading && !isError && searchResults && searchResults.length > 0 && (
        <p className="mb-4 text-sm text-neutral-600">{dictionary.search.previewNotice}</p>
      )}

      {isLoading && (
        <div>
          <Skeleton count={3} />
        </div>
      )}

      {!isLoading && isError && (
        <StateCard
          type="error"
          title={dictionary.search.loadFailedTitle}
          message={dictionary.search.loadFailedMessage}
          action={
            <Button
              type="button"
              onClick={onRetry}
            >
              {dictionary.search.retry}
            </Button>
          }
        />
      )}

      {!isLoading && !isError && failedSources.length === 0 && (!searchResults || searchResults.length === 0) && (
        <StateCard
          type="info"
          title={dictionary.search.noResultsTitle}
          message={`"${searchQuery}" ${dictionary.search.noResultsMessage}`}
          action={
            <Button
              variant="secondary"
              type="button"
              onClick={onClear}
            >
              {dictionary.search.cancel}
            </Button>
          }
        />
      )}

      {!isLoading && !isError && searchResults && searchResults.length > 0 && (
        <SearchResultSection
          categorizedResults={categorizedResults}
          searchQuery={searchQuery}
        />
      )}
    </Container>
  );
}
