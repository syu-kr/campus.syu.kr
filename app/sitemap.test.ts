import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ notices: vi.fn(), announcements: vi.fn() }));
vi.mock("@/lib/serviceNotices", () => ({ getAllServiceNotices: mocks.notices }));
vi.mock("@/lib/server/announcements", () => ({ getAnnouncementSitemapItems: mocks.announcements }));

import sitemap from "./sitemap";

beforeEach(() => {
  mocks.notices.mockResolvedValue([{ slug: "017-roommate-board", date: "2026-10-01" }]);
  mocks.announcements.mockResolvedValue([
    { category: "academic", id: "notice / 한글" },
    { category: "sw", id: "sw-1" },
  ]);
});

it("discovers localized announcement details with matching language alternates and no invented modification date", async () => {
  const entries = await sitemap();
  const path = "/announcements/academic/notice%20%2F%20%ED%95%9C%EA%B8%80";
  const ko = `https://campus.syu.kr${path}`;
  const en = `https://campus.syu.kr/en${path}`;
  expect(entries.find((entry) => entry.url === ko)).toMatchObject({
    alternates: { languages: { ko, en, "x-default": ko } },
  });
  expect(entries.find((entry) => entry.url === en)?.alternates?.languages).toEqual({ ko, en, "x-default": ko });
  expect(entries.find((entry) => entry.url === ko)?.lastModified).toBeUndefined();
  expect(entries.some((entry) => entry.url.endsWith("/announcements/sw/sw-1"))).toBe(true);
});

it("preserves public routes while excluding private, API, submission and meeting-room URLs", async () => {
  const urls = (await sitemap()).map((entry) => new URL(entry.url).pathname);
  expect(urls).toContain("/campus/cafeteria");
  expect(urls).toContain("/en/campus/cafeteria");
  expect(urls).toContain("/service/notices/017-roommate-board");
  expect(urls).toContain("/en/service/notices/017-roommate-board");
  expect(urls.some((url) => /\/(?:api|admin)(?:\/|$)|\/campus\/roommates(?:\/|$)|\/campus-tips\/suggest|\/more\/meet\//.test(url))).toBe(false);
});

it("uses the latest public detail inventory when a new sitemap is requested", async () => {
  await sitemap();
  mocks.announcements.mockResolvedValue([{ category: "campus", id: "new" }]);
  const urls = (await sitemap()).map((entry) => entry.url);
  expect(urls).toContain("https://campus.syu.kr/announcements/campus/new");
  expect(urls).not.toContain("https://campus.syu.kr/announcements/sw/sw-1");
});

it("uses a managed notice publication timestamp rather than its saved draft time", async () => {
  mocks.notices.mockResolvedValue([{ slug: "managed", date: "2026-10-01", modifiedAt: "2026-10-26T09:00:00Z" }]);
  const entries = (await sitemap()).filter(entry => entry.url.endsWith("/service/notices/managed"));
  expect(entries).toHaveLength(2);expect(entries.every(entry => entry.lastModified === "2026-10-26T09:00:00Z")).toBe(true);
});
