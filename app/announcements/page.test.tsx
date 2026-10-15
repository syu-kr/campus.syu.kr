import { headers } from "next/headers";
import { expect, it, vi } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { getAnnouncementPage } from "@/lib/server/announcements";
import AnnouncementsPage from "./page";
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
  expect(getAnnouncementPage).toHaveBeenLastCalledWith({ category });
  expect(element.props).toMatchObject({ category, title, initialPage });
});
