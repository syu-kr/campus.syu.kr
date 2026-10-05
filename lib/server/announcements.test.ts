import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Announcement } from "@/types";

const mocks = vi.hoisted(() => ({ read: vi.fn(), attach: vi.fn(async (items: unknown[]) => items) }));
vi.mock("./crawl-data", () => ({ readDailyCrawlDataSnapshot: mocks.read }));
vi.mock("./announcement-ai", () => ({ attachAnnouncementAiSummaries: mocks.attach }));

function notice(id: string, date: string, fields: Partial<Announcement> = {}): Announcement {
  return { id, title: id, author: "학생처", date, category: "academic", content: "본문", views: 0, isImportant: false, ...fields };
}

beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-05T00:00:00Z"));
  mocks.read.mockReset(); mocks.attach.mockClear();
  mocks.read.mockResolvedValue({ source: "bundled-fallback", data: [notice("notice-1", "2026.09.21")] });
});
afterEach(() => { vi.useRealTimers(); });

it("reports the date of bundled notices when the published source fails", async () => {
  const { getAnnouncementPage } = await import("./announcements");
  const page = await getAnnouncementPage({ category: "academic" });
  expect(page.items).toHaveLength(1);
  expect(page.fallbackSources).toEqual([
    { category: "academic", latestDate: "2026.09.21" },
  ]);
});

it("preserves category priorities, global dates, stable ties and pagination while reusing sorted sources", async () => {
  mocks.read.mockImplementation(async (file: string) => ({
    source: "github-pages",
    data: file === "announcements-academic.json" ? [
      notice("pinned", "2026.10.01", { isPinned: true }),
      notice("important", "2026.10.02", { isImportant: true }),
      notice("latest", "2026.10.05"), notice("tie", "2026.10.05"),
    ] : file === "announcements-campus-life.json" ? [notice("campus", "2026.10.06", { category: "campus" })] : [],
  }));
  const { getAnnouncementPage, getAnnouncementSummary } = await import("./announcements");
  expect((await getAnnouncementPage({ category: "academic", limit: 2 })).items.map((item) => item.id)).toEqual(["pinned", "important"]);
  expect((await getAnnouncementPage({ category: "academic", page: 2, limit: 2 })).items.map((item) => item.id)).toEqual(["latest", "tie"]);
  const all = await getAnnouncementPage({ category: "all" });
  expect(all.items.map((item) => item.id)).toEqual(["campus", "latest", "tie", "important", "pinned"]);
  const sorts = vi.spyOn(Array.prototype, "sort");
  const dates = vi.spyOn(Date.prototype, "getTime");
  const nextPage = await getAnnouncementPage({ category: "all", page: 2, limit: 2 });
  const search = await getAnnouncementPage({ category: "academic", query: "latest" });
  const summary = await getAnnouncementSummary(3);
  const sortCalls = sorts.mock.calls.length;
  const dateCalls = dates.mock.calls.length;
  expect(nextPage.items.map((item) => item.id)).toEqual(["tie", "important"]);
  expect(search.items.map((item) => item.id)).toEqual(["latest"]);
  expect(summary.map((item) => item.id)).toEqual(["campus", "latest", "tie"]);
  expect(mocks.read).toHaveBeenCalledTimes(4);
  expect(sortCalls).toBe(0);
  expect(dateCalls).toBe(0);
});

it("invalidates merged ordering when source caches expire and does not truncate detail content", async () => {
  mocks.read.mockImplementation(async (file: string) => ({ source: "github-pages", data: file === "announcements-academic.json" ? [notice("old", "2026.10.01", { content: "가".repeat(400) })] : [] }));
  const { getAnnouncementPage, getAnnouncementById, getAnnouncementSummary } = await import("./announcements");
  expect((await getAnnouncementPage({})).items.map((item) => item.id)).toEqual(["old"]);
  expect((await getAnnouncementSummary())[0].content).toHaveLength(240);
  expect((await getAnnouncementById("academic", "old"))?.content).toHaveLength(400);
  mocks.read.mockImplementation(async (file: string) => ({ source: "github-pages", data: file === "announcements-campus-life.json" ? [notice("new", "2026.10.06", { category: "campus" })] : [] }));
  vi.advanceTimersByTime(60_000);
  const page = await getAnnouncementPage({});
  expect(page.items.map((item) => item.id)).toEqual(["new"]);
  expect(page.total).toBe(1);
  expect(mocks.read).toHaveBeenCalledTimes(8);
});

it("keeps source order for equal global dates while prioritizing pinned notices in a category", async () => {
  mocks.read.mockImplementation(async (file: string) => ({
    source: "github-pages",
    data: file === "announcements-academic.json" ? [
      notice("ordinary", "2026.10.05"),
      notice("important", "2026.10.05", { isImportant: true }),
      notice("pinned", "2026.10.05", { isPinned: true }),
    ] : file === "announcements-campus-life.json" ? [notice("campus", "2026.10.05", { category: "campus", isPinned: true })] : [],
  }));
  const { getAnnouncementPage, getAnnouncementSummary } = await import("./announcements");
  const expected = ["ordinary", "important", "pinned", "campus"];
  expect((await getAnnouncementPage({})).items.map((item) => item.id)).toEqual(expected);
  expect((await getAnnouncementSummary()).map((item) => item.id)).toEqual(expected);
  expect((await getAnnouncementPage({ category: "academic" })).items.map((item) => item.id)).toEqual(["pinned", "important", "ordinary"]);
});
