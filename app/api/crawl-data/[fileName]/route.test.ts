// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { readDailyCrawlDataSnapshot } from "@/lib/server/crawl-data";
import { GET } from "./route";

vi.mock("@/lib/server/crawl-data", () => ({ readDailyCrawlDataSnapshot: vi.fn() }));

const menus = { id: "sulounge", menus: [{ date: "2026-10-15", day: "목", meals: { lunch: ["밥"] } }] };
const checkedAt = "2026-10-15T01:00:00Z";
const request = new Request("https://campus.syu.kr/api/crawl-data/cafeteria-menu.json");
const context = { params: Promise.resolve({ fileName: "cafeteria-menu.json" }) };

describe("cafeteria source metadata API", () => {
  it.each([menus, [menus]])("adds confirmation from the same snapshot while preserving the payload shape", async (data) => {
    vi.mocked(readDailyCrawlDataSnapshot).mockResolvedValue({
      data, source: "github-pages", version: "v1", publishedAt: "2026-10-15T02:00:00Z",
      sourceHealth: { status: "fresh", lastAttemptAt: checkedAt, lastSuccessAt: checkedAt },
    });
    const response = await GET(request, context);
    const body = await response.json();
    expect(body).toEqual(Array.isArray(data)
      ? [{ ...menus, checkedAt, stale: false }]
      : { ...menus, checkedAt, stale: false });
    expect(response.headers.get("X-Crawl-Data-Version")).toBe("v1");
  });

  it.each([
    { source: "github-pages" as const, status: "stale" as const, expectedAt: checkedAt, stale: true },
    { source: "bundled-fallback" as const, status: "fresh" as const, expectedAt: null, stale: true },
    { source: "github-pages" as const, status: null, expectedAt: null, stale: false },
  ])("does not confuse $source/$status metadata with publication time", async ({ source, status, expectedAt, stale }) => {
    vi.mocked(readDailyCrawlDataSnapshot).mockResolvedValue({
      data: { ...menus, lastUpdated: "2026-10-15T10:00:00" }, source, version: "v1",
      publishedAt: "2026-10-15T02:00:00Z",
      ...(status ? { sourceHealth: { status, lastAttemptAt: checkedAt, lastSuccessAt: checkedAt } } : {}),
    });
    expect(await (await GET(request, context)).json()).toMatchObject({ checkedAt: expectedAt, stale });
  });

  it("preserves non-cafeteria payloads and read failures", async () => {
    vi.mocked(readDailyCrawlDataSnapshot).mockResolvedValueOnce({ data: [{ id: "notice" }], source: "github-pages", version: "v1" });
    const response = await GET(request, { params: Promise.resolve({ fileName: "announcements-academic.json" }) });
    expect(await response.json()).toEqual([{ id: "notice" }]);
    vi.mocked(readDailyCrawlDataSnapshot).mockRejectedValueOnce(new Error("read failure"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await GET(request, context)).status).toBe(500);
  });
});
