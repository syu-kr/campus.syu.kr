"use client";

import type { ReactNode } from "react";
import { useDictionary } from "@/app/components/LocaleProvider";
import { Button, buttonStyles } from "./Button";
import { SlidingIndicator } from "./SlidingIndicator";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageRange?: number;
  getPageHref?: (page: number) => string;
}

export function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  pageRange = 5,
  getPageHref,
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

  const pageControl = (page: number, label: ReactNode, disabled = false, numbered = false) => {
    const variant = numbered && currentPage === page ? "primary" : "secondary";
    const className = numbered ? "min-w-11 px-2 md:px-3" : "px-2 md:px-3";
    const current = numbered && currentPage === page ? "page" as const : undefined;

    if (getPageHref && !disabled) {
      return (
        <a href={getPageHref(page)} aria-current={current} data-selection-value={numbered ? page : undefined} className={buttonStyles(variant, className)}
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onPageChange(page);
          }}>
          {label}
        </a>
      );
    }

    return (
      <Button variant={variant} onClick={() => onPageChange(page)} disabled={disabled}
        aria-current={current} data-selection-value={numbered ? page : undefined} className={className}>
        {label}
      </Button>
    );
  };

  return (
    <nav
      aria-label={dictionary.pagination.label}
      className="m3-pagination"
    >
      <div className="m3-pagination-step">
        {pageControl(Math.max(1, currentPage - 1), dictionary.pagination.previous, currentPage === 1)}
        <span className="m3-pagination-status" role="status" aria-live="polite">{currentPage} / {totalPages}</span>
        {pageControl(Math.min(totalPages, currentPage + 1), dictionary.pagination.next, currentPage === totalPages)}
      </div>
      <div className="m3-pagination-pages m3-selection-track" data-selection-tone="primary">
        <SlidingIndicator value={currentPage} />
        {pageNumbers.map((page) => <span key={page}>{pageControl(page, page, false, true)}</span>)}
      </div>

      {endPage < totalPages && (
        <label className="m3-pagination-jump">
        <span>{dictionary.pagination.pageSelect}</span>
        <select
          aria-label={dictionary.pagination.pageSelect}
          value={currentPage}
          onChange={(event) => onPageChange(Number(event.target.value))}
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
        </label>
      )}
    </nav>
  );
}
