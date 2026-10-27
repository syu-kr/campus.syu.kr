"use client";

import { useId, type ReactNode } from "react";
import { useDictionary } from "@/app/components/LocaleProvider";
import { Button, buttonStyles } from "./Button";
import { SlidingIndicator } from "./SlidingIndicator";
import { M3Select } from "./M3Select";

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
  const selectId = useId();

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
        <div className="m3-pagination-jump">
        <label id={`${selectId}-label`} htmlFor={selectId}>{dictionary.pagination.pageSelect}</label>
        <M3Select
          id={selectId}
          variant="tonal"
          leadingIcon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" focusable="false">
              <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5" />
            </svg>
          }
          value={String(currentPage)}
          onValueChange={(value) => onPageChange(Number(value))}
          options={[
            { value: String(currentPage), label: String(currentPage) },
            ...Array.from({ length: totalPages }, (_, index) => index + 1)
            .slice(endPage)
            .map((page) => ({ value: String(page), label: String(page) })),
          ]}
        />
        </div>
      )}
    </nav>
  );
}
