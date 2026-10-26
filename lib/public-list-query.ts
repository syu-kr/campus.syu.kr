import type { Metadata } from "next";
import { getAnnouncementListQuery, type AnnouncementListSearchParams } from "./announcement-list-query";
import { createLocalizedAlternates, type Locale } from "./i18n/routing";

export const competitionStatusFilters = ["open", "result", "closed", "all"] as const;
export const competitionSourceFilters = ["all", "event", "department", "academic", "campus", "scholarship"] as const;
export const campusTipViewFilters = ["campus-tips", "essential", "department", "campus-life", "study", "external", "all"] as const;
export const campusTipCategoryFilters = ["all", "school", "campus-life", "finance", "certificate", "activity", "career", "culture", "local", "reference"] as const;
export type CampusTipViewFilter = (typeof campusTipViewFilters)[number];

export function replaceListParams(params: AnnouncementListSearchParams, updates: Record<string, string | undefined>): string {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) result.append(key, item);
  }
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) result.delete(key);
    else result.set(key, value);
  }
  return result.size ? `?${result}` : "";
}

function choice<T extends string>(value: string | string[] | undefined, choices: readonly T[], fallback: T): T {
  const first = Array.isArray(value) ? value[0] : value;
  return choices.find(item => item === first) ?? fallback;
}

export function getCompetitionListQuery(params: AnnouncementListSearchParams) {
  return {
    ...getAnnouncementListQuery(params),
    source: choice(params.source, competitionSourceFilters, "all"),
    status: choice(params.status, competitionStatusFilters, "open"),
  };
}

export function getCampusTipsListQuery(params: AnnouncementListSearchParams) {
  return {
    ...getAnnouncementListQuery(params),
    view: choice(params.view, campusTipViewFilters, "campus-tips"),
    category: choice(params.category, campusTipCategoryFilters, "all"),
  };
}

export function getPublicListMetadata(pathname: string, page: number, filtered: boolean, locale: Locale): Metadata {
  const canonicalPath = !filtered && page > 1 ? `${pathname}?page=${page}` : pathname;
  return {
    alternates: createLocalizedAlternates(canonicalPath, locale),
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}
