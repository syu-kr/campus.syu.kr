import type { Dictionary } from "./i18n";
import type { CampusTip, CampusTipCategory, CampusTipContentKind, CampusTipSourceType, CampusTipVisibility } from "@/types";
import { campusTipCategoryFilters as categoryFilters, type CampusTipViewFilter } from "./public-list-query";

type CampusTipsDictionary = Dictionary["pages"]["campusTips"];
const categoryOrder = new Map<string, number>(categoryFilters.map((category, index) => [category, index]));

export function getCampusTipsAvailableCategories(tips: CampusTip[], view: CampusTipViewFilter) {
  const categories = new Set(tips.filter(tip => matchesViewFilter(tip, view)).map(tip => tip.category));
  return categoryFilters.filter(category => category === "all" || categories.has(category));
}

export function filterCampusTips(tips: CampusTip[], query: { query: string; view: CampusTipViewFilter; category: CampusTipCategory | "all" }, locale: string, text: CampusTipsDictionary): CampusTip[] {
  const needle = query.query.trim().toLowerCase();
  return tips.filter(tip => matchesViewFilter(tip, query.view))
    .filter(tip => query.category === "all" || tip.category === query.category)
    .filter(tip => !needle || [tip.title, tip.description, tip.note, getCategoryLabel(tip.category, text), getSourceLabel(tip.sourceType, text), getContentKindLabel(getContentKind(tip), text), ...tip.tags]
      .filter(Boolean).join(" ").toLowerCase().includes(needle))
    .sort((a, b) => sortTips(a, b, locale));
}

function sortTips(a: CampusTip, b: CampusTip, locale: string): number {
  const visibilityDiff =
    getVisibilityPriority(getVisibility(a)) -
    getVisibilityPriority(getVisibility(b));
  if (visibilityDiff !== 0) return visibilityDiff;

  const kindDiff =
    getContentKindPriority(getContentKind(a)) -
    getContentKindPriority(getContentKind(b));
  if (kindDiff !== 0) return kindDiff;

  const categoryDiff =
    (categoryOrder.get(a.category) ?? 99) -
    (categoryOrder.get(b.category) ?? 99);
  if (categoryDiff !== 0) return categoryDiff;

  const priorityDiff = getTipPriority(a) - getTipPriority(b);
  if (priorityDiff !== 0) return priorityDiff;

  const sourceDiff =
    getSourcePriority(a.sourceType) - getSourcePriority(b.sourceType);
  if (sourceDiff !== 0) return sourceDiff;

  return a.title.localeCompare(b.title, locale);
}

function matchesViewFilter(tip: CampusTip, view: CampusTipViewFilter): boolean {
  const kind = getContentKind(tip);

  if (view === "all") return true;
  if (view === "campus-tips") return isDirectCampusTip(tip, kind);
  if (view === "essential") {
    return (
      isDirectCampusTip(tip, kind) &&
      (kind === "official-link" || kind === "public-link")
    );
  }
  if (view === "department") {
    return isDirectCampusTip(tip, kind) && kind === "department-channel";
  }
  if (view === "study") return kind === "study-review";
  if (view === "external") {
    return !isDirectCampusTip(tip, kind) && kind !== "study-review";
  }

  return (
    (isDirectCampusTip(tip, kind) && kind === "local-life") ||
    (tip.category === "campus-life" &&
      isDirectCampusTip(tip, kind) &&
      kind !== "study-review" &&
      kind !== "community-post" &&
      kind !== "external-directory")
  );
}

export function getViewLabel(
  view: CampusTipViewFilter,
  text: CampusTipsDictionary,
): string {
  if (view === "campus-tips") return text.views.campusTips;
  if (view === "essential") return text.views.essential;
  if (view === "department") return text.views.department;
  if (view === "campus-life") return text.views.campusLife;
  if (view === "study") return text.views.study;
  if (view === "external") return text.views.external;
  return text.views.all;
}

export function getCategoryLabel(
  category: CampusTipCategory,
  text: CampusTipsDictionary,
): string {
  if (category === "school") return text.categories.school;
  if (category === "campus-life") return text.categories.campusLife;
  if (category === "finance") return text.categories.finance;
  if (category === "certificate") return text.categories.certificate;
  if (category === "activity") return text.categories.activity;
  if (category === "career") return text.categories.career;
  if (category === "culture") return text.categories.culture;
  if (category === "local") return text.categories.local;
  return text.categories.reference;
}

export function getSourceLabel(
  sourceType: CampusTipSourceType,
  text: CampusTipsDictionary,
): string {
  if (sourceType === "official") return text.sources.official;
  if (sourceType === "public") return text.sources.public;
  if (sourceType === "community") return text.sources.community;
  return text.sources.external;
}

export function getContentKindLabel(
  contentKind: CampusTipContentKind,
  text: CampusTipsDictionary,
): string {
  if (contentKind === "official-link") return text.contentKinds.officialLink;
  if (contentKind === "public-link") return text.contentKinds.publicLink;
  if (contentKind === "department-channel") {
    return text.contentKinds.departmentChannel;
  }
  if (contentKind === "study-review") return text.contentKinds.studyReview;
  if (contentKind === "external-directory") {
    return text.contentKinds.externalDirectory;
  }
  if (contentKind === "community-post") return text.contentKinds.communityPost;
  return text.contentKinds.localLife;
}

function getTipPriority(tip: CampusTip): number {
  if (typeof tip.sortPriority === "number") return tip.sortPriority;
  if (tip.category === "school" && tip.id.startsWith("school-instagram-")) {
    return 900;
  }
  return 500;
}

function getVisibility(tip: CampusTip): CampusTipVisibility {
  if (tip.visibility) return tip.visibility;

  const kind = getContentKind(tip);
  if (isDirectCampusTip(tip, kind)) return "featured";
  if (kind === "department-channel" || kind === "local-life") return "default";
  return "archive";
}

function isDirectCampusTip(
  tip: CampusTip,
  kind = getContentKind(tip),
): boolean {
  if (
    kind === "external-directory" ||
    kind === "community-post" ||
    kind === "study-review"
  ) {
    return false;
  }

  if (
    tip.category === "activity" ||
    tip.category === "career" ||
    tip.category === "certificate"
  ) {
    return false;
  }

  if (tip.category === "finance") {
    return kind === "official-link" || kind === "public-link";
  }

  return (
    kind === "official-link" ||
    kind === "public-link" ||
    kind === "department-channel" ||
    kind === "local-life"
  );
}

export function getContentKind(tip: CampusTip): CampusTipContentKind {
  if (tip.contentKind) return tip.contentKind;

  if (
    tip.id.startsWith("school-instagram-") ||
    hasUrlHost(tip.url, ["instagram.com"])
  ) {
    return "department-channel";
  }

  if (isSutoryReviewTip(tip)) {
    return "study-review";
  }

  if (tip.sourceType === "community" || hasUrlHost(tip.url, ["everytime.kr"])) {
    return "community-post";
  }

  if (isExternalReferenceTip(tip)) {
    return "external-directory";
  }

  if (tip.category === "local" || tip.category === "culture") {
    return "local-life";
  }

  if (tip.sourceType === "official") return "official-link";
  if (tip.sourceType === "public") return "public-link";

  return "external-directory";
}

function isExternalReferenceTip(tip: CampusTip): boolean {
  if (tip.category === "activity" || tip.category === "career") return true;

  if (
    tip.sourceType === "external" &&
    tip.category !== "local" &&
    tip.category !== "culture"
  ) {
    return true;
  }

  return hasUrlHost(tip.url, [
    "linkareer.com",
    "allforyoung.com",
    "wevity.com",
    "contestkorea.com",
    "all-con.co.kr",
    "ssgsag.kr",
  ]);
}

function isSutoryReviewTip(tip: CampusTip): boolean {
  if (hasUrlHost(tip.url, ["sutory.syu.ac.kr"])) {
    const pathname = getUrlPathname(tip.url);
    if (pathname.startsWith("/archives/") || pathname.startsWith("/infinity/")) {
      return true;
    }
  }

  if (!tip.id.startsWith("campus-life-sutory-")) return false;

  return [
    "advice",
    "freshman",
    "lab-tip",
    "method",
    "midterm",
    "minor",
    "plan-tip",
    "recipe",
    "review",
    "study",
    "theory",
  ].some((keyword) => tip.id.includes(keyword));
}

function getVisibilityPriority(visibility: CampusTipVisibility): number {
  if (visibility === "featured") return 0;
  if (visibility === "default") return 1;
  return 2;
}

function getContentKindPriority(contentKind: CampusTipContentKind): number {
  if (contentKind === "official-link") return 0;
  if (contentKind === "public-link") return 1;
  if (contentKind === "department-channel") return 2;
  if (contentKind === "local-life") return 3;
  if (contentKind === "study-review") return 4;
  if (contentKind === "external-directory") return 5;
  return 6;
}

function getSourcePriority(sourceType: CampusTipSourceType): number {
  if (sourceType === "official") return 0;
  if (sourceType === "public") return 1;
  if (sourceType === "external") return 2;
  return 3;
}

export function getCategoryBadgeColor(
  category: CampusTipCategory,
): "blue" | "red" | "green" | "yellow" | "purple" | "gray" {
  if (category === "school") return "blue";
  if (category === "campus-life") return "green";
  if (category === "finance") return "yellow";
  if (category === "certificate") return "purple";
  if (category === "activity") return "red";
  return "gray";
}

export function getContentKindBadgeColor(
  contentKind: CampusTipContentKind,
): "blue" | "red" | "green" | "yellow" | "purple" | "gray" {
  if (contentKind === "official-link") return "blue";
  if (contentKind === "public-link") return "green";
  if (contentKind === "department-channel") return "purple";
  if (contentKind === "study-review") return "yellow";
  if (contentKind === "external-directory") return "red";
  return "gray";
}

export function getSourceBadgeColor(
  sourceType: CampusTipSourceType,
): "blue" | "red" | "green" | "yellow" | "purple" | "gray" {
  if (sourceType === "official") return "blue";
  if (sourceType === "public") return "green";
  if (sourceType === "community") return "yellow";
  return "gray";
}

function hasUrlHost(url: string, allowedHosts: string[]): boolean {
  const host = getUrlHost(url);
  if (!host) return false;

  return allowedHosts.some(
    (allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`),
  );
}

function getUrlHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return "";
  }
}

function getUrlPathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}
