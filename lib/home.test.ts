import { describe, expect, it } from "vitest";

import { getDictionary } from "./i18n";
import type { Locale } from "./i18n/routing";
import { categorizeSearchResults, isFestivalPromotionVisible, type HomeSearchResult } from "./home";

describe("festival promotion", () => {
  it("shows through the festival day and expires afterward", () => {
    expect(isFestivalPromotionVisible("2026-09-27")).toBe(false);
    expect(isFestivalPromotionVisible("2026-09-28")).toBe(true);
    expect(isFestivalPromotionVisible("2026-10-06")).toBe(true);
    expect(isFestivalPromotionVisible("2026-10-07")).toBe(false);
  });
});

describe.each(["ko", "en"] as const)("search categories for %s", (locale) => {
  it("uses the supplied category labels and keeps every result in its localized destination", () => {
    const labels = getDictionary(locale).categories;
    const announcements = (["academic", "campus", "scholarship", "sw"] as const).map((category) => ({
      id: category, title: category, content: "", category, date: "2026-10-20",
      author: "", views: 0, isImportant: false,
    }));
    const schedule = { id: "schedule", title: "schedule", startDate: "2026.10.20", endDate: "2026.10.20", category: "event" as const };
    const phone = { department: "office", phone: "02-1234-5678" };
    const results: HomeSearchResult[] = [...announcements, schedule, phone];
    const grouped = categorizeSearchResults(results, labels, locale);
    const prefix = locale === "en" ? "/en" : "";
    expect(grouped.academicSchedule).toEqual({ label: labels.academicSchedule, items: [schedule], linkPath: `${prefix}/academic/schedule` });
    expect(grouped.phoneNumbers).toEqual({ label: labels.phoneNumbers, items: [phone], linkPath: `${prefix}/campus/phone` });
    for (const [index, key] of ["academicAnnouncement", "campusAnnouncement", "scholarship", "swAnnouncement"].entries()) {
      expect(grouped[key].items).toEqual([announcements[index]]);
      expect(grouped[key].label).toBe(labels[key as keyof typeof labels]);
      expect(grouped[key].linkPath.startsWith(`${prefix}/`)).toBe(true);
    }
  });
});

it("keeps empty groups and Korean paths for an unrecognized locale", () => {
  const grouped = categorizeSearchResults(undefined, getDictionary("ko").categories, "unknown" as Locale);
  expect(Object.values(grouped)).toHaveLength(6);
  expect(Object.values(grouped).every((group) => group.items.length === 0)).toBe(true);
  expect(grouped.academicSchedule.linkPath).toBe("/academic/schedule");
});
