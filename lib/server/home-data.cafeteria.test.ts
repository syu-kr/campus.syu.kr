import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCafeteriaMenu } from "../api";
import { getHomeCafeteriaMenus } from "./home-data";
import { readDailyCrawlDataJson } from "./crawl-data";

vi.mock("./crawl-data", () => ({ readDailyCrawlDataJson: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

const source = { menus: [
  { date: "2026-10-05", day: "월", meals: { breakfast: ["죽"], lunch: ["밥"], dinner: ["국"] } },
  { date: "2026-10-06", day: "화", meals: { lunch: { a_corner: ["비빔밥"], b_corner: ["면"] } } },
  { date: "2026-10-07", day: "수" },
] };

describe("shared cafeteria conversion", () => {
  it.each([source, [source]])("preserves both source shapes, meal corners, IDs, and the client date filter", async (data) => {
    vi.mocked(readDailyCrawlDataJson).mockResolvedValue(data);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(data)));
    const menus = await getHomeCafeteriaMenus();
    expect(await fetchCafeteriaMenu()).toEqual(menus);
    expect(menus).toEqual([
      { id: "cafeteria-2026-10-05-0", date: "2026-10-05", dayOfWeek: "월", breakfast: [{ name: "죽" }], lunch: { a: [{ name: "밥" }] }, dinner: [{ name: "국" }], location: "SU-Lounge" },
      { id: "cafeteria-2026-10-06-1", date: "2026-10-06", dayOfWeek: "화", breakfast: [], lunch: { a: [{ name: "비빔밥" }], b: [{ name: "면" }] }, dinner: [], location: "SU-Lounge" },
      { id: "cafeteria-2026-10-07-2", date: "2026-10-07", dayOfWeek: "수", breakfast: [], lunch: {}, dinner: [], location: "SU-Lounge" },
    ]);
    expect(await fetchCafeteriaMenu("2026-10-06")).toEqual([menus[1]]);
  });

  it("keeps the server empty-list fallback and the client malformed-source error", async () => {
    vi.mocked(readDailyCrawlDataJson).mockResolvedValue({});
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({})));
    await expect(getHomeCafeteriaMenus()).resolves.toEqual([]);
    await expect(fetchCafeteriaMenu()).rejects.toThrow("Invalid cafeteria data structure");
  });
});
