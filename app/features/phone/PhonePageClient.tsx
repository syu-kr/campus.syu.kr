"use client";

import { Container } from "@/app/components/Container";

import { Card } from "@/app/components/Card";
import {
  AnswerSummaryCard,
  type AnswerSummary,
} from "@/app/components/AnswerSummaryCard";
import {
  useDictionary,
  useLocale,
} from "@/app/components/LocaleProvider";
import { SearchBar } from "@/app/components/SearchBar";
import { Skeleton } from "@/app/components/Skeleton";
import { PhoneCallButton } from "@/app/components/PhoneCallButton";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPhoneNumbers } from "@/lib/api";
import { usePagination } from "@/lib/use-pagination";
import type { PhoneNumber } from "@/types";

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

type PhonePageClientProps = {
  answerSummary: AnswerSummary;
  initialPhoneNumbers: PhoneNumber[];
};

export default function PhonePageClient({
  answerSummary,
  initialPhoneNumbers,
}: PhonePageClientProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.pages.phone;
  const numberLocale = locale === "ko" ? "ko-KR" : "en-US";
  const ITEMS_PER_PAGE = 10;
  const [searchQuery, setSearchQuery] = useState("");

  const { data: phoneData, isLoading } = useQuery({
    queryKey: ["phone-numbers"],
    queryFn: () => fetchPhoneNumbers(),
    initialData: initialPhoneNumbers,
    staleTime: ONE_HOUR,
    gcTime: ONE_DAY,
  });

  // 검색 필터링
  const filteredDirectory = useMemo(() => {
    if (!phoneData) return [];
    if (!searchQuery.trim()) return phoneData;

    const lowerQuery = searchQuery.toLowerCase();
    return phoneData.filter(
      (item) =>
        item.department.toLowerCase().includes(lowerQuery) ||
        item.phone.includes(searchQuery) ||
        item.description?.toLowerCase().includes(lowerQuery),
    );
  }, [searchQuery, phoneData]);

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems: paginatedDirectory,
    pageNumbers,
  } = usePagination(filteredDirectory, ITEMS_PER_PAGE, {
    mobilePageRange: 5,
    desktopPageRange: 5,
  });

  // 검색어 변경 시 첫 페이지로 이동
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          {text.title}
        </h1>
        <p className="text-neutral-600">{text.description}</p>
      </div>

      <div className="mb-6">
        <AnswerSummaryCard summary={answerSummary} />
      </div>

      <SearchBar
        className="mb-6"
        defaultValue={searchQuery}
        placeholder={text.placeholder}
        onSearch={handleSearch}
        onClear={() => handleSearch("")}
        searchOnChange
      />

      {!isLoading && (
        <div className="mb-4 text-sm text-neutral-600">
          {formatPhoneCount(filteredDirectory.length, text.itemsFoundSuffix, locale)}
          {searchQuery && ` (${text.searchQuery}: "${searchQuery}")`}
          {filteredDirectory.length > 0 && (
            <span className="ml-2">
              - {((currentPage - 1) * ITEMS_PER_PAGE + 1).toLocaleString(numberLocale)} ~{" "}
              {Math.min(
                currentPage * ITEMS_PER_PAGE,
                filteredDirectory.length,
              ).toLocaleString(numberLocale)}
              {locale === "ko" ? "" : " "}
              {text.showingSuffix}
            </span>
          )}
        </div>
      )}

      <div className="space-y-3">
        {isLoading && <Skeleton count={5} />}
        {!isLoading && filteredDirectory.length === 0 ? (
          <Card>
            <div className="py-8 text-center text-neutral-500">
              {text.empty}
            </div>
          </Card>
        ) : (
          !isLoading &&
          paginatedDirectory.map((item) => (
            <Card key={`${item.department}-${item.phone}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-neutral-900 mb-1">
                    {item.department}
                  </h3>
                  <p className="text-sm text-neutral-600">{item.phone}</p>
                  {item.description && (
                    <p className="mt-1 text-sm text-neutral-500">
                      {item.description}
                    </p>
                  )}
                </div>
                <PhoneCallButton
                  department={item.department}
                  phone={item.phone}
                  phoneNumbers={item.phoneNumbers}
                />
              </div>
            </Card>
          ))
        )}
      </div>

      {!isLoading && filteredDirectory.length > ITEMS_PER_PAGE && (
        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="flex flex-wrap justify-center gap-2">
            <button
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
            {currentPage.toLocaleString(numberLocale)} /{" "}
            {totalPages.toLocaleString(numberLocale)} {text.page}
          </p>
        </div>
      )}

      <Card className="mt-8 bg-blue-50 border border-blue-200">
        <p className="text-sm text-blue-900">
          {text.notice}
        </p>
      </Card>
    </Container>
  );
}

function formatPhoneCount(value: number, suffix: string, locale: "ko" | "en") {
  const formattedValue = value.toLocaleString(locale === "ko" ? "ko-KR" : "en-US");

  return locale === "ko" ? `${formattedValue}${suffix}` : `${formattedValue} ${suffix}`;
}
