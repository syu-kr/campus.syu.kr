import { headers } from "next/headers";
import { expect, it, vi } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { getAnnouncementPage } from "@/lib/server/announcements";
import AnnouncementsPage, { generateMetadata } from "./page";
import AcademicAnnouncementsPage from "../academic/announcements/page";
import CampusAnnouncementsPage from "../campus/announcements/page";
import ScholarshipPage from "../academic/scholarship/page";
import SwNoticesPage from "../academic/sw-notices/page";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/server/announcements", () => ({ getAnnouncementPage: vi.fn() }));

it.each([
  ["all", AnnouncementsPage, getDictionary("en").pages.announcements.allTitle],
  ["academic", AcademicAnnouncementsPage, getDictionary("en").pages.announcements.academicTitle],
  ["campus", CampusAnnouncementsPage, getDictionary("en").pages.announcements.campusTitle],
  ["scholarship", ScholarshipPage, getDictionary("en").pages.scholarship.title],
  ["sw", SwNoticesPage, getDictionary("en").pages.announcements.swTitle],
] as const)("passes the initial %s page and request locale from the server", async (category, Page, title) => {
  const initialPage = { items: [], total: 0, page: 1, limit: 10, totalPages: 1, fallbackSources: [] };
  vi.mocked(headers).mockResolvedValue(new Headers({ "x-syu-locale": "en" }) as Awaited<ReturnType<typeof headers>>);
  vi.mocked(getAnnouncementPage).mockResolvedValue(initialPage);

  const element = await Page();
  expect(getAnnouncementPage).toHaveBeenLastCalledWith({ category, page: 1, query: "" });
  expect(element.props).toMatchObject({ category, title, initialPage });
});

it.each([
  ["all", AnnouncementsPage], ["academic", AcademicAnnouncementsPage],
  ["campus", CampusAnnouncementsPage], ["scholarship", ScholarshipPage], ["sw", SwNoticesPage],
] as const)("renders the requested %s search and page on the server", async (category, Page) => {
  vi.mocked(headers).mockResolvedValue(new Headers({ "x-syu-locale": "ko" }) as Awaited<ReturnType<typeof headers>>);
  const initialPage = { items: [], total: 80, page: 3, limit: 10, totalPages: 8, fallbackSources: [] };
  vi.mocked(getAnnouncementPage).mockResolvedValue(initialPage);
  const element = await Page({ searchParams: Promise.resolve({ search: " 장학 ", page: "3", lang: "ko" }) });
  expect(getAnnouncementPage).toHaveBeenLastCalledWith({ category, query: " 장학 ", page: 3 });
  expect(element.props).toMatchObject({ category, initialQuery: " 장학 ", initialPage });
});

it("overrides only list alternates and search indexing while inheriting the layout title", async () => {
  vi.mocked(headers).mockResolvedValue(new Headers({ "x-syu-locale": "en" }) as Awaited<ReturnType<typeof headers>>);
  const metadata = await generateMetadata({ searchParams: Promise.resolve({ page: "2" }) });
  expect(metadata.alternates?.canonical).toBe("/en/announcements?page=2");
  expect(metadata).not.toHaveProperty("title");
  expect(metadata).not.toHaveProperty("description");
  const searchMetadata = await generateMetadata({ searchParams: Promise.resolve({ page: "2", search: "장학" }) });
  expect(searchMetadata.robots).toEqual({ index: false, follow: true });
  expect(searchMetadata.alternates?.canonical).toBe("/en/announcements");
});
