// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyPublicHolidays } from "../public-holidays";
import { readDailyCrawlDataSnapshot } from "./crawl-data";
import { getHomePublicHolidays } from "./home-data";

vi.mock("./crawl-data", () => ({ readDailyCrawlDataSnapshot: vi.fn(), readDailyCrawlDataJson: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));

beforeEach(() => vi.resetAllMocks());

describe("home public holiday source health", () => {
  it("uses the source health rather than publication time as holiday freshness", async () => {
    vi.mocked(readDailyCrawlDataSnapshot).mockResolvedValue({
      data: emptyPublicHolidays(), source: "github-pages", version: "v1",
      publishedAt: "2026-10-05T00:00:00Z",
      sourceHealth: { status: "stale", lastAttemptAt: "2026-10-05T00:00:00Z", errorCode: "CRAWLER_FAILED" },
    });
    expect(await getHomePublicHolidays()).toMatchObject({ stale: true, lastSuccessAt: null });
  });

  it("marks bundled fallback as stale and contains malformed holiday data", async () => {
    vi.mocked(readDailyCrawlDataSnapshot).mockResolvedValue({ data: emptyPublicHolidays(), source: "bundled-fallback", version: "bundled" });
    expect((await getHomePublicHolidays()).stale).toBe(true);
    vi.mocked(readDailyCrawlDataSnapshot).mockResolvedValue({ data: {}, source: "github-pages", version: "bad" });
    expect(await getHomePublicHolidays()).toEqual(emptyPublicHolidays());
  });
});
