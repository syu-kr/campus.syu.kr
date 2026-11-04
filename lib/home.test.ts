import { describe, expect, it } from "vitest";

import { getDictionary } from "./i18n";
import type { Locale } from "./i18n/routing";
import { categorizeSearchResults, getHomeNotices, getSemesterEndCountdown, getTodayInfo, isFestivalPromotionVisible, type HomeSearchResult } from "./home";
import schedules from "@/public/data/schedules-major.json";
import type { AcademicSchedule, Announcement, ServiceNotice } from "@/types";

describe("home notices", () => {
  const announcements: Announcement[] = ["2026.11.04", "2026.11.02", "2026.10.30"].map(date => ({
    id: date, title: date, content: "", category: "academic", date,
    author: "", views: 0, isImportant: false,
  }));
  const previous: ServiceNotice = {
    id: "previous", slug: "previous", title: "Previous update", date: "2026-11-03", author: "SYU CAMPUS",
  };

  it.each([
    "2026-11-04T13:34:39.482Z",
    "2026-11-04T22:34:39.482+09:00",
    "2026-11-04T13:34:39Z",
  ])("includes a newly published service notice in the latest three for %s", (date) => {
    const latest = { ...previous, id: "latest", slug: "latest", title: "Latest update", date };

    expect(getHomeNotices(announcements, [previous, latest])).toEqual([
      { type: "service", data: latest },
      { type: "announcement", data: announcements[0] },
      { type: "service", data: previous },
    ]);
  });

  it("keeps invalid dates after valid notices", () => {
    const invalid = { ...previous, date: "invalid-date" };

    expect(getHomeNotices([announcements[0]], [invalid])).toEqual([
      { type: "announcement", data: announcements[0] },
      { type: "service", data: invalid },
    ]);
  });
});

describe("semester end countdown", () => {
  const calendar = schedules as AcademicSchedule[];
  it("counts to the day after the current term's final exams", () => {
    expect(getSemesterEndCountdown(calendar, "2026-10-31")).toEqual({ days: 45 });
    expect(getSemesterEndCountdown(calendar, "2026-04-01")).toEqual({ days: 76 });
    expect(getSemesterEndCountdown(calendar, "2026-12-14")).toEqual({ days: 1 });
    expect(getSemesterEndCountdown(calendar, "2026-06-15")).toEqual({ days: 1 });
  });
  it("starts on the actual opening day", () => {
    expect(getSemesterEndCountdown(calendar, "2026-03-03")).toEqual({ days: 105 });
    expect(getSemesterEndCountdown(calendar, "2026-09-01")).toEqual({ days: 105 });
    expect(getSemesterEndCountdown(calendar.filter(item => !item.title.startsWith("개강")), "2026-10-31")).toBeNull();
  });
  it("falls back after exams, during vacation, or without this year's schedule", () => {
    for (const date of ["2026-03-01", "2026-03-02", "2026-12-15", "2026-06-16", "2026-08-31", "2027-01-01", "2027-10-31", ""]) {
      expect(getSemesterEndCountdown(calendar, date)).toBeNull();
    }
    expect(getSemesterEndCountdown([], "2026-10-31")).toBeNull();
  });
  it("counts calendar days at Korea midnight", () => {
    const before = getTodayInfo(new Date("2026-12-13T14:59:59Z")).dateStringDash;
    const after = getTodayInfo(new Date("2026-12-13T15:00:00Z")).dateStringDash;
    expect(getSemesterEndCountdown(calendar, before)?.days).toBe(2);
    expect(getSemesterEndCountdown(calendar, after)?.days).toBe(1);
  });
});

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
