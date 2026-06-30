"use client";

import { useState, useMemo } from "react";
import { searchFacilities, categoryColors } from "../lib/mapData";
import { Card } from "@/app/components/Card";
import { Icon } from "@/app/components/Icon";
import {
  useDictionary,
  useLocale,
} from "@/app/components/LocaleProvider";
import {
  formatMapFloor,
  getFacilityCategoryLabel,
  formatMapCountSummary,
} from "../lib/mapI18n";

interface FacilitySearchProps {
  onSelect?: (buildingId: string) => void;
}

export function FacilitySearch({ onSelect }: FacilitySearchProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.pages.map;
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchFacilities(query);
  }, [query]);

  return (
    <div className="relative">
      <div className="relative mb-3">
        <div className="flex items-center gap-2 bg-white border border-neutral-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent">
          <Icon
            name="search"
            size={18}
            color="rgb(156, 163, 175)"
          />
          <input
            type="text"
            placeholder={text.searchPlaceholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="flex-1 outline-none text-sm text-neutral-900 placeholder-neutral-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setIsOpen(false);
              }}
              className="rounded p-1 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              aria-label={text.clearSearch}
            >
              <Icon
                name="x"
                size={16}
                color="rgb(156, 163, 175)"
              />
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <Card className="absolute top-14 left-0 right-0 z-50 max-h-96 overflow-y-auto shadow-lg">
          {results.length === 0 ? (
            <div className="p-4 text-center text-neutral-500 text-sm">
              {query ? text.noResults : text.enterQuery}
            </div>
          ) : (
            <div className="divide-y">
              {results.map((result, idx) => (
                <button
                  key={`${result.building.id}-${result.facility?.id || "building"}-${idx}`}
                  type="button"
                  onClick={() => {
                    onSelect?.(result.building.id);
                    setQuery("");
                    setIsOpen(false);
                  }}
                  className="w-full p-3 text-left transition-colors hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset"
                >
                  <div className="flex items-start gap-3">
                    {result.facility && (
                      <div className="mt-1 flex flex-shrink-0 items-center gap-1">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor:
                              categoryColors[result.facility.category!] ||
                              "#95A5A6",
                          }}
                        />
                        <span className="text-[10px] text-neutral-500">
                          {getFacilityCategoryLabel(
                            result.facility.category,
                            text,
                          )}
                        </span>
                      </div>
                    )}
                    {!result.facility && (
                      <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1 bg-blue-600" />
                    )}
                    <div className="flex-1 min-w-0">
                      {result.facility ? (
                        <>
                          <h4 className="font-semibold text-neutral-900 text-sm">
                            {result.facility.name}
                          </h4>
                          <p className="text-xs text-neutral-600 mt-0.5">
                            {result.building.name}{" "}
                            {formatMapFloor(result.floor!.floor, locale, text)}
                          </p>
                          {result.facility.description && (
                            <p className="text-xs text-neutral-500 mt-1">
                              {result.facility.description}
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <h4 className="font-semibold text-neutral-900 text-sm">
                            {result.building.name}
                          </h4>
                          <p className="text-xs text-neutral-600 mt-0.5">
                            {formatMapCountSummary(
                              result.building.floors.length,
                              result.building.floors.reduce(
                                (acc, f) => acc + f.facilities.length,
                                0,
                              ),
                              locale,
                              text,
                            )}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {isOpen && results.length > 0 && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}
