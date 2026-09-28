"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function useUrlSearch(): [string, (value: string) => void] {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("search") ?? "";
  const [query, setQuery] = useState(urlQuery);

  useEffect(() => setQuery(urlQuery), [urlQuery]);

  const updateQuery = useCallback((value: string) => {
    setQuery(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) params.set("search", value);
    else params.delete("search");
    window.history.replaceState(null, "", `${pathname}${params.size ? `?${params}` : ""}`);
  }, [pathname, searchParams]);

  return [query, updateQuery];
}
