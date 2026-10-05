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

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems,
    pageRange,
  };
}
