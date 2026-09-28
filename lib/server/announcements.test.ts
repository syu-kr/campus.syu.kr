import { expect, it, vi } from "vitest";
import { getAnnouncementPage } from "./announcements";

vi.mock("./crawl-data", () => ({
  readDailyCrawlDataSnapshot: vi.fn(async () => ({
    source: "bundled-fallback",
    data: [{
      id: "notice-1",
      title: "장학금 안내",
      author: "학생처",
      date: "2026.09.21",
      category: "academic",
      content: "",
      views: 0,
      isImportant: false,
    }],
  })),
}));
vi.mock("./announcement-ai", () => ({
  attachAnnouncementAiSummaries: vi.fn(async (items: unknown[]) => items),
}));

it("reports the date of bundled notices when the published source fails", async () => {
  const page = await getAnnouncementPage({ category: "academic" });
  expect(page.items).toHaveLength(1);
  expect(page.fallbackSources).toEqual([
    { category: "academic", latestDate: "2026.09.21" },
  ]);
});
