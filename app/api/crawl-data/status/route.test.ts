import { describe, expect, it, vi } from "vitest";
import { readDailyCrawlSourceHealth } from "@/lib/server/crawl-data";
import { GET } from "./route";

vi.mock("@/lib/server/crawl-data", () => ({ readDailyCrawlSourceHealth: vi.fn() }));

describe("crawl source status API", () => {
  it("returns verified source health without changing dataset response shapes", async () => {
    const sourceHealth = {
      "cafeteria-menu.json": {
        status: "stale" as const,
        lastAttemptAt: "2026-10-03T10:00:00Z",
        errorCode: "CRAWLER_FAILED" as const,
      },
    };
    vi.mocked(readDailyCrawlSourceHealth).mockResolvedValueOnce(sourceHealth);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sourceHealth });
  });

  it("reports status lookup failure instead of claiming every source is fresh", async () => {
    vi.mocked(readDailyCrawlSourceHealth).mockRejectedValueOnce(new Error("integrity"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).not.toHaveProperty("sourceHealth");
  });
});
