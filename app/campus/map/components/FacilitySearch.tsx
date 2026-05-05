"use client";

import { useState, useMemo } from "react";
import { searchFacilities, categoryColors, formatFloor } from "../lib/mapData";
import { Card } from "@/app/components/Card";
import { Icon } from "@/app/components/Icon";

interface FacilitySearchProps {
  onSelect?: (buildingId: string) => void;
}

export function FacilitySearch({ onSelect }: FacilitySearchProps) {
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
            title="검색"
          />
          <input
            type="text"
            placeholder="건물명 또는 시설 검색 (예: 도서관, 음악관, 카페...)"
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
              onClick={() => {
                setQuery("");
                setIsOpen(false);
              }}
              className="p-1 hover:bg-neutral-100 rounded"
              aria-label="검색어 삭제"
            >
              <Icon
                name="x"
                size={16}
                color="rgb(156, 163, 175)"
                title="검색어 삭제"
              />
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <Card className="absolute top-14 left-0 right-0 z-50 max-h-96 overflow-y-auto shadow-lg">
          {results.length === 0 ? (
            <div className="p-4 text-center text-neutral-500 text-sm">
              {query ? "검색 결과가 없습니다." : "검색어를 입력하세요."}
            </div>
          ) : (
            <div className="divide-y">
              {results.map((result, idx) => (
                <button
                  key={`${result.building.id}-${result.facility?.id || "building"}-${idx}`}
                  onClick={() => {
                    onSelect?.(result.building.id);
                    setQuery("");
                    setIsOpen(false);
                  }}
                  className="w-full p-3 hover:bg-neutral-50 text-left transition-colors"
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
                          {result.facility.category}
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
                            {formatFloor(result.floor!.floor)}
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
                            {result.building.floors.length}개 층 ·{" "}
                            {result.building.floors.reduce(
                              (acc, f) => acc + f.facilities.length,
                              0,
                            )}
                            개 시설
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
