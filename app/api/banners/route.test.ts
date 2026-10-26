import { beforeEach, expect, it, vi } from "vitest";
import { getPublicBanners } from "@/lib/server/public-managed-content";
import { GET } from "./route";
vi.mock("@/lib/server/public-managed-content", () => ({ getPublicBanners: vi.fn() }));
beforeEach(() => { vi.mocked(getPublicBanners).mockReset().mockResolvedValue([]); });
it("accepts a known placement and never browser-caches scheduled content", async () => {
  const response = await GET(new Request("https://campus.syu.kr/api/banners?placement=home"));
  expect(getPublicBanners).toHaveBeenCalledWith("home");expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ banners: [] });
});
it("rejects unknown placements before querying published content", async () => {
  expect((await GET(new Request("https://campus.syu.kr/api/banners?placement=private"))).status).toBe(400);
  expect(getPublicBanners).not.toHaveBeenCalled();
});
