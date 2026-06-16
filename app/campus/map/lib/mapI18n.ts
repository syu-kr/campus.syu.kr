import type { Dictionary, Locale } from "@/lib/i18n";

type MapDictionary = Dictionary["pages"]["map"];

export function formatMapFloor(
  floorNumber: number,
  locale: Locale,
  text: MapDictionary,
) {
  if (locale === "ko") {
    if (floorNumber < 0) {
      return `${text.basementFloor}${Math.abs(floorNumber)}${text.floorSuffix}`;
    }

    return `${floorNumber}${text.floorSuffix}`;
  }

  if (floorNumber < 0) {
    return `${text.basementFloor}${Math.abs(floorNumber)}`;
  }

  return `${floorNumber}${text.floorSuffix}`;
}

export function formatMapCountSummary(
  floors: number,
  facilities: number,
  locale: Locale,
  text: MapDictionary,
) {
  if (locale === "ko") {
    return `${text.totalPrefix} ${floors}${text.floorsUnit} · ${facilities}${text.facilitiesUnit}`;
  }

  return `${text.totalPrefix} ${floors} ${text.floorsUnit} · ${facilities} ${text.facilitiesUnit}`;
}

export function getFacilityCategoryLabel(
  category: string | undefined,
  text: MapDictionary,
) {
  const labels: Record<string, string> = {
    식당: text.categories.restaurant,
    카페: text.categories.cafe,
    의료: text.categories.medical,
    도서관: text.categories.library,
    체육: text.categories.sports,
    편의: text.categories.convenience,
    사무: text.categories.office,
    학습: text.categories.study,
  };

  return category ? labels[category] ?? category : "";
}
