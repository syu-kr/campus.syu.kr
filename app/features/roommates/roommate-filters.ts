import { parseRoommateFilters } from "@/lib/roommates";
import type { RoommatePostFilters } from "@/types/roommates";

export function serializeRoommateFilters(filters: RoommatePostFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [field, value] of Object.entries(filters)) {
    if (field === "habits") {
      for (const [habit, selected] of Object.entries(filters.habits ?? {})) {
        if (selected && (!Array.isArray(selected) || selected.length)) params.set(habit, Array.isArray(selected) ? selected.join(",") : selected);
      }
    } else if (value) params.set(field, String(value));
  }
  return params;
}

export function readRoommateFilterUrl(search: string) {
  const params = new URLSearchParams(search);
  const filters = parseRoommateFilters(params);
  return { filters, query: serializeRoommateFilters(filters).toString(), cursor: params.get("cursor") ?? "" };
}
