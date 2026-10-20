"use client";

import React, { useState, useCallback, memo, useEffect, useRef } from "react";
import clsx from "clsx";
import { useDictionary } from "@/app/components/LocaleProvider";

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
  placeholder,
  onSearch,
  defaultValue = "",
  onClear,
  searchOnChange = false,
  isLoading = false,
  className,
}: SearchBarProps) {
  const dictionary = useDictionary();
  const [query, setQuery] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousDefaultValue = useRef<string | undefined>(undefined);
  const inputPlaceholder = placeholder ?? dictionary.search.defaultPlaceholder;

  useEffect(() => {
    if (previousDefaultValue.current === undefined) {
      previousDefaultValue.current = defaultValue;
      // Adopt pre-hydration typing without replacing an input event already queued by React.
      const initialValue = inputRef.current?.value ?? defaultValue;
      if (initialValue !== defaultValue) {
        setQuery((current) => current === defaultValue ? initialValue : current);
        if (searchOnChange) onSearch(initialValue);
      }
      return;
    }
    if (previousDefaultValue.current === defaultValue) return;
    previousDefaultValue.current = defaultValue;
    setQuery(defaultValue);
  }, [defaultValue, onSearch, searchOnChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    previousDefaultValue.current ??= defaultValue;
    setQuery(value);
    if (searchOnChange) {
      onSearch(value);
    }
  }, [defaultValue, onSearch, searchOnChange]);

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
    if (onClear) onClear();
    else onSearch("");
  }, [onClear, onSearch]);

  return (
    <form onSubmit={handleSubmit} className={className} role="search">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          placeholder={inputPlaceholder}
          className={clsx(
            "min-h-14 w-full px-4 py-3 pl-10 bg-neutral-50 border border-neutral-200 rounded-lg",
            "pr-28",
            "text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
            "transition-all",
          )}
          aria-label={dictionary.search.label}
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
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
            className="absolute right-13 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center hover:bg-neutral-200 rounded-lg transition-colors"
            aria-label={dictionary.search.clear}
          >
            <svg
              className="w-4 h-4 text-neutral-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
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
          <div className="absolute right-13 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center">
            <div className="w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full motion-safe:animate-spin" />
          </div>
        )}
        <button
          type="submit"
          className="absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
          aria-label={dictionary.search.submit}
          disabled={!query.trim() || isLoading}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
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
