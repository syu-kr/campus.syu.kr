"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Container } from "@/app/components/Container";
import { SearchBar } from "@/app/components/SearchBar";
import { ServiceSearchLinks } from "@/app/components/ServiceSearchLinks";

export function useHomeSearch() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("search")?.trim() ?? "";

  const handleSearch = useCallback((query: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const normalized = query.trim();
    if (normalized) params.set("search", normalized);
    else params.delete("search");
    router.push(`${pathname}${params.size ? `?${params}` : ""}`);
  }, [pathname, router, searchParams]);

  const handleSearchClear = useCallback(() => {
    handleSearch("");
  }, [handleSearch]);

  return { searchQuery, handleSearch, handleSearchClear };
}

export function HomeSearchBar() {
  const { searchQuery, handleSearch } = useHomeSearch();
  const [draft, setDraft] = useState("");
  if (searchQuery) return null;

  return (
    <Container className="pt-5 sm:pt-8">
      <p className="sr-only">SYU CAMPUS</p>
      <SearchBar onSearch={handleSearch} onQueryChange={setDraft} className="mt-2" />
      <ServiceSearchLinks query={draft} />
    </Container>
  );
}
