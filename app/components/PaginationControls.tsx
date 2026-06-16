"use client";

import { useDictionary } from "@/app/components/LocaleProvider";

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
    <div className="mt-8 flex flex-wrap items-center justify-center gap-1 md:gap-2">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="rounded-lg bg-neutral-200 px-2 py-2 text-sm text-neutral-900 transition-colors hover:bg-neutral-300 disabled:cursor-not-allowed disabled:opacity-50 md:px-3"
      >
        {dictionary.pagination.previous}
      </button>

      {pageNumbers.map((page) => (
        <button
          key={page}
          type="button"
          onClick={() => onPageChange(page)}
          className={`rounded-lg px-2 py-2 text-sm transition-colors md:px-3 ${
            currentPage === page
              ? "bg-primary-600 text-white"
              : "bg-neutral-200 text-neutral-900 hover:bg-neutral-300"
          }`}
        >
          {page}
        </button>
      ))}

      {endPage < totalPages && (
        <select
          value={currentPage}
          onChange={(event) => onPageChange(Number(event.target.value))}
          className="rounded-lg bg-neutral-200 px-2 py-2 text-sm text-neutral-900 focus:ring-2 focus:ring-primary-500 md:px-3"
        >
          {Array.from({ length: totalPages }, (_, index) => index + 1)
            .slice(endPage)
            .map((page) => (
              <option key={page} value={page}>
                {page}
              </option>
            ))}
        </select>
      )}

      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="rounded-lg bg-neutral-200 px-2 py-2 text-sm text-neutral-900 transition-colors hover:bg-neutral-300 disabled:cursor-not-allowed disabled:opacity-50 md:px-3"
      >
        {dictionary.pagination.next}
      </button>
    </div>
  );
}
