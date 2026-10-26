import { useMemo, useState, useSyncExternalStore } from "react";

interface UsePaginationOptions {
  mobilePageRange?: number;
  desktopPageRange?: number;
  initialPage?: number;
}

const mobileQuery = "(max-width: 767px)";
function subscribeMobile(callback: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const getIsMobile = () => typeof window.matchMedia === "function" ? window.matchMedia(mobileQuery).matches : window.innerWidth < 768;

export function usePagination<T>(
  items: T[],
  itemsPerPage: number,
  options: UsePaginationOptions = {},
) {
  const { mobilePageRange = 5, desktopPageRange = 10, initialPage = 1 } = options;

  const [requestedPage, setCurrentPage] = useState(initialPage);
  const isMobile = useSyncExternalStore(subscribeMobile, getIsMobile, () => false);

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const currentPage = Math.max(1, Math.min(requestedPage, totalPages || 1));
  const paginatedItems = useMemo(
    () =>
      items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [items, currentPage, itemsPerPage],
  );

  const pageRange = isMobile ? mobilePageRange : desktopPageRange;

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems,
    pageRange,
  };
}
