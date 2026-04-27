import { useMemo, useState } from "react";

interface UsePaginationOptions {
  mobilePageRange?: number;
  desktopPageRange?: number;
}

export function usePagination<T>(
  items: T[],
  itemsPerPage: number,
  options: UsePaginationOptions = {},
) {
  const { mobilePageRange = 5, desktopPageRange = 10 } = options;

  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const paginatedItems = useMemo(
    () =>
      items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [items, currentPage, itemsPerPage],
  );

  const pageRange =
    typeof window !== "undefined" && window.innerWidth < 768
      ? mobilePageRange
      : desktopPageRange;

  const startPage = Math.max(1, currentPage - Math.floor(pageRange / 2));
  const endPage = Math.min(totalPages, startPage + pageRange - 1);
  const adjustedStartPage = Math.max(1, endPage - pageRange + 1);

  const pageNumbers = useMemo(
    () =>
      Array.from(
        { length: Math.min(pageRange, endPage - adjustedStartPage + 1) },
        (_, i) => adjustedStartPage + i,
      ),
    [pageRange, endPage, adjustedStartPage],
  );

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems,
    pageRange,
    endPage,
    pageNumbers,
  };
}
