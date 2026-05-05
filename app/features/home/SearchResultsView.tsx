import { Container } from "@/app/components/Container";
import { SearchBar } from "@/app/components/SearchBar";
import { SearchResultSection } from "@/app/components/SearchResultSection";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
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
  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-6 space-y-3">
        <SearchBar
          onSearch={onSearch}
          onClear={onClear}
          defaultValue={searchQuery}
          placeholder="검색..."
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-neutral-600">
            <span className="font-semibold text-neutral-900">
              &quot;{searchQuery}&quot;
            </span>{" "}
            검색 결과
          </p>
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            검색 초기화 / 홈으로
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
          title="검색 결과가 없습니다"
          message={`"${searchQuery}"와 일치하는 결과가 없습니다. 공지 제목, 일정명, 부서명, 전화번호로 검색할 수 있습니다.`}
          action={
            <button
              type="button"
              onClick={onClear}
              className="inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            >
              검색 취소
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
