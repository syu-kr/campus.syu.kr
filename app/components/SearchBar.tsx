"use client";

import React, { useState, useCallback, memo, useEffect } from "react";
import clsx from "clsx";

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  defaultValue?: string;
  onClear?: () => void;
  searchOnChange?: boolean;
  isLoading?: boolean;
  className?: string;
}

function SearchBarComponent({
  placeholder = "공지, 학식, 학사일정 검색...",
  onSearch,
  defaultValue = "",
  onClear,
  searchOnChange = false,
  isLoading = false,
  className,
}: SearchBarProps) {
  const [query, setQuery] = useState(defaultValue);

  useEffect(() => {
    setQuery(defaultValue);
  }, [defaultValue]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    if (searchOnChange) {
      onSearch(value);
    }
  }, [onSearch, searchOnChange]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        onSearch(query);
      }
    },
    [query, onSearch],
  );

  const handleClear = useCallback(() => {
    setQuery("");
    onClear?.();
    onSearch("");
  }, [onClear, onSearch]);

  return (
    <form onSubmit={handleSubmit} className={className} role="search">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder={placeholder}
          className={clsx(
            "w-full px-4 py-3 pl-10 bg-neutral-50 border border-neutral-200 rounded-lg",
            "pr-24",
            "text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
            "transition-all",
          )}
          aria-label="검색"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {query && !isLoading && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-12 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-200 rounded transition-colors"
            aria-label="검색어 삭제"
          >
            <svg
              className="w-4 h-4 text-neutral-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
        {isLoading && (
          <div className="absolute right-14 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
          </div>
        )}
        <button
          type="submit"
          className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
          aria-label="검색 실행"
          disabled={!query.trim() || isLoading}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </button>
      </div>
    </form>
  );
}

export const SearchBar = memo(SearchBarComponent);
