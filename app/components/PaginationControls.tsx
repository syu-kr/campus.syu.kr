"use client";

import { useDictionary } from "@/app/components/LocaleProvider";
import { Button } from "./Button";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageRange?: number;
}

export function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  pageRange = 5,
}: PaginationControlsProps) {
  const dictionary = useDictionary();

  if (totalPages <= 1) return null;

  const startPage = Math.max(1, currentPage - Math.floor(pageRange / 2));
  const endPage = Math.min(totalPages, startPage + pageRange - 1);
  const adjustedStartPage = Math.max(1, endPage - pageRange + 1);
  const pageNumbers = Array.from(
    { length: Math.min(pageRange, endPage - adjustedStartPage + 1) },
    (_, index) => adjustedStartPage + index,
  );

  return (
    <nav
      aria-label={dictionary.pagination.label}
      className="mt-8 flex flex-wrap items-center justify-center gap-1 md:gap-2"
    >
      <Button
        variant="secondary"
        type="button"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="px-2 md:px-3"
      >
        {dictionary.pagination.previous}
      </Button>

      {pageNumbers.map((page) => (
        <Button
          key={page}
          type="button"
          aria-current={currentPage === page ? "page" : undefined}
          onClick={() => onPageChange(page)}
          variant={currentPage === page ? "primary" : "secondary"}
          className="min-w-11 px-2 md:px-3"
        >
          {page}
        </Button>
      ))}

      {endPage < totalPages && (
        <select
          aria-label={dictionary.pagination.pageSelect}
          value={currentPage}
          onChange={(event) => onPageChange(Number(event.target.value))}
          className="min-h-11 rounded-button border border-neutral-300 bg-white px-2 py-2 text-sm text-neutral-700 focus-visible:ring-2 focus-visible:ring-primary-500 md:px-3"
        >
          <option value={currentPage}>{currentPage}</option>
          {Array.from({ length: totalPages }, (_, index) => index + 1)
            .slice(endPage)
            .map((page) => (
              <option key={page} value={page}>
                {page}
              </option>
            ))}
        </select>
      )}

      <Button
        variant="secondary"
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="px-2 md:px-3"
      >
        {dictionary.pagination.next}
      </Button>
    </nav>
  );
}
