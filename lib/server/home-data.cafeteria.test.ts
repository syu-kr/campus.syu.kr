import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCafeteriaMenu, fetchCafeteriaSnapshot } from "../api";
import { getHomeCafeteriaSnapshot } from "./home-data";
import { readDailyCrawlDataSnapshot } from "./crawl-data";

vi.mock("./crawl-data", () => ({ readDailyCrawlDataSnapshot: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

const source = { menus: [
  { date: "2026-10-05", day: "월", meals: { breakfast: ["죽"], lunch: ["밥"], dinner: ["국"] } },
  { date: "2026-10-06", day: "화", meals: { lunch: { a_corner: ["비빔밥"], b_corner: ["면"] } } },
  { date: "2026-10-07", day: "수" },
] };

describe("shared cafeteria conversion", () => {
  it.each([source, [source]])("preserves both source shapes, meal corners, IDs, and the client date filter", async (data) => {
    vi.mocked(readDailyCrawlDataSnapshot).mockResolvedValue({ data, source: "github-pages", version: "v1" });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(data)));
    const { menus } = await getHomeCafeteriaSnapshot();
    expect(await fetchCafeteriaMenu()).toEqual(menus);
    expect(menus).toEqual([
      { id: "cafeteria-2026-10-05-0", date: "2026-10-05", dayOfWeek: "월", breakfast: [{ name: "죽" }], lunch: { a: [{ name: "밥" }] }, dinner: [{ name: "국" }], location: "SU-Lounge" },
      { id: "cafeteria-2026-10-06-1", date: "2026-10-06", dayOfWeek: "화", breakfast: [], lunch: { a: [{ name: "비빔밥" }], b: [{ name: "면" }] }, dinner: [], location: "SU-Lounge" },
      { id: "cafeteria-2026-10-07-2", date: "2026-10-07", dayOfWeek: "수", breakfast: [], lunch: {}, dinner: [], location: "SU-Lounge" },
    ]);
    expect(await fetchCafeteriaMenu("2026-10-06")).toEqual([menus[1]]);
  });

  it("keeps the server empty-list fallback and the client malformed-source error", async () => {
    vi.mocked(readDailyCrawlDataSnapshot).mockResolvedValue({ data: {}, source: "github-pages", version: "v1" });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({})));
    await expect(getHomeCafeteriaSnapshot()).resolves.toMatchObject({ menus: [] });
    await expect(fetchCafeteriaMenu()).rejects.toThrow("Invalid cafeteria data structure");
  });

  it.each([
    { source: "github-pages" as const, status: "fresh" as const, checkedAt: "2026-10-05T01:00:00Z", stale: false },
    { source: "github-pages" as const, status: "stale" as const, checkedAt: "2026-10-05T01:00:00Z", stale: true },
    { source: "bundled-fallback" as const, status: "fresh" as const, checkedAt: null, stale: true },
  ])("keeps the source confirmation attached to the exact $source/$status snapshot", async ({ source: dataSource, status, checkedAt, stale }) => {
    vi.mocked(readDailyCrawlDataSnapshot).mockResolvedValue({
      data: { ...source, lastUpdated: "2026-10-07T04:00:00" },
      source: dataSource,
      version: "v1",
      publishedAt: "2026-10-07T03:00:00Z",
      sourceHealth: { status, lastAttemptAt: "2026-10-07T02:00:00Z", lastSuccessAt: "2026-10-05T01:00:00Z" },
    });
    expect(await getHomeCafeteriaSnapshot()).toMatchObject({ checkedAt, stale });
  });

  it("does not substitute legacy update/publication/request times for a missing source confirmation", async () => {
    const data = { ...source, lastUpdated: "2026-10-07T04:00:00" };
    vi.mocked(readDailyCrawlDataSnapshot).mockResolvedValue({ data, source: "github-pages", version: "v1", publishedAt: "2026-10-07T03:00:00Z" });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(data)));
    expect(await getHomeCafeteriaSnapshot()).toMatchObject({ checkedAt: null, stale: false });
    expect(await fetchCafeteriaSnapshot()).toMatchObject({ checkedAt: null, stale: false });
  });

  it.each([source, [source]])("carries API confirmation and stale state without breaking either source shape", async (data) => {
    const metadata = { checkedAt: "2026-10-05T01:00:00Z", stale: true };
    const response = Array.isArray(data) ? data.map((entry) => ({ ...entry, ...metadata })) : { ...data, ...metadata };
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(response)));
    expect(await fetchCafeteriaSnapshot()).toMatchObject(metadata);
    expect(await fetchCafeteriaMenu()).toHaveLength(3);
  });

  it("treats an invalid confirmation as unknown", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ...source, checkedAt: "bad time" })));
    expect((await fetchCafeteriaSnapshot()).checkedAt).toBeNull();
  });
});
