"use client";

import { Container } from "@/app/components/Container";
import { Button } from "@/app/components/Button";

import { Card } from "@/app/components/Card";
import {
  useDictionary,
  useLocale,
} from "@/app/components/LocaleProvider";
import { SearchBar } from "@/app/components/SearchBar";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { PhoneCallButton } from "@/app/components/PhoneCallButton";
import { PaginationControls } from "@/app/components/PaginationControls";
import { Fragment, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPhoneNumbers } from "@/lib/api";
import { getPhoneDisplayText, matchesPhoneQuery } from "@/lib/phone";
import { usePagination } from "@/lib/use-pagination";
import { useUrlSearch } from "@/lib/use-url-search";
import type { PhoneNumber } from "@/types";

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

type PhonePageClientProps = {
  initialPhoneNumbers: PhoneNumber[];
};

export default function PhonePageClient({
  initialPhoneNumbers,
}: PhonePageClientProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.pages.phone;
  const numberLocale = locale === "ko" ? "ko-KR" : "en-US";
  const ITEMS_PER_PAGE = 10;
  const [searchQuery, setSearchQuery] = useUrlSearch();

  const { data: phoneData, isLoading, isError, refetch } = useQuery({
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

    return phoneData.filter((item) => matchesPhoneQuery(item, searchQuery));
  }, [searchQuery, phoneData]);

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems: paginatedDirectory,
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

      <SearchBar
        className="mb-6"
        defaultValue={searchQuery}
        placeholder={text.placeholder}
        onSearch={handleSearch}
        onClear={() => handleSearch("")}
        searchOnChange
      />

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

      {!isLoading && (!isError || Boolean(phoneData?.length)) && (
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
        {!isLoading && !isError && filteredDirectory.length === 0 ? (
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
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold text-neutral-900 mb-1">
                    {item.department}
                  </h3>
                  <p className="text-sm text-neutral-600 break-words">
                    {getPhoneDisplayText(item).split(", ").map((number, index) => (
                      <Fragment key={`${number}-${index}`}>
                        {index > 0 && ", "}
                        <span className="inline-block max-w-full">{number}</span>
                      </Fragment>
                    ))}
                  </p>
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
        <div className="flex flex-col items-center gap-4">
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            pageRange={5}
          />

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
