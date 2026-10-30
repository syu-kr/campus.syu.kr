import { beforeEach, expect, it, vi } from "vitest";
const reader = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/public-managed-content", () => ({ readPublicBanners: reader }));
import { GET } from "./route";
beforeEach(() => reader.mockReset().mockResolvedValue([]));

it.each(["home", "site-top", "popup"])("accepts placement %s and never browser-caches scheduled content", async placement => {
  const response = await GET(new Request(`https://campus.syu.kr/api/banners?placement=${placement}`));
  expect(reader).toHaveBeenCalledWith(placement);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ banners: [] });
});

it("distinguishes a successful empty list from a failed read so the client can retry outages", async () => {
  reader.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("private upstream details"));
  const request = new Request("https://campus.syu.kr/api/banners?placement=home");
  const empty = await GET(request);
  expect(empty.status).toBe(200);
  expect(await empty.json()).toEqual({ banners: [] });
  const failure = await GET(request);
  expect(failure.status).toBe(503);
  expect(failure.headers.get("cache-control")).toBe("no-store");
  expect(await failure.text()).not.toContain("private upstream details");
});

it("rejects unknown placements before querying published content", async () => {
  const response = await GET(new Request("https://campus.syu.kr/api/banners?placement=private"));
  expect(response.status).toBe(400);
  expect(reader).not.toHaveBeenCalled();
});
