"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/fetch-json";
import { parseStudentRestaurantMenu, parseStudentRestaurantPublicUrl } from "@/lib/student-restaurant";

async function fetchStudentRestaurantMenu(jsonUrl: string, firebaseDataEnabled: boolean) {
  if (!firebaseDataEnabled) parseStudentRestaurantPublicUrl(jsonUrl);
  const value = await fetchJson<unknown>("/api/public-data/student-restaurant-1.json", {
    fallback: null,
    throwOnError: true,
    timeoutMs: 12_000,
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
  });
  return parseStudentRestaurantMenu(value);
}

export function useStudentRestaurantMenu(firebaseDataEnabled = false) {
  const jsonUrl = process.env.NEXT_PUBLIC_CAFETERIA_JSON_URL?.trim() ?? "";
  const isConfigured = firebaseDataEnabled || Boolean(jsonUrl);
  const query = useQuery({
    queryKey: ["student-restaurant", firebaseDataEnabled ? "firebase" : jsonUrl],
    queryFn: () => fetchStudentRestaurantMenu(jsonUrl, firebaseDataEnabled),
    enabled: isConfigured,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
  return { ...query, isConfigured };
}
