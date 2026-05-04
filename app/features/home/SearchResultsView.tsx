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
      <SearchBar onSearch={onSearch} placeholder="검색..." className="mb-6" />

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
