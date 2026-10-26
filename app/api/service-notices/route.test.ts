import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getAllServiceNotices } from "@/lib/serviceNotices";
vi.mock("@/lib/serviceNotices", () => ({ getAllServiceNotices: vi.fn() }));
beforeEach(() => { vi.mocked(getAllServiceNotices).mockReset().mockResolvedValue([]); });
it("selects reviewed English notices without depending on a cookie or changing public IDs", async () => {
  const response = await GET(new Request("https://campus.syu.kr/api/service-notices?locale=en"));
  expect(getAllServiceNotices).toHaveBeenCalledWith("en");
  expect(response.headers.get("Content-Language")).toBe("en");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
it("does not turn a failed managed-notice read into a successful empty list", async () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getAllServiceNotices).mockRejectedValue(new Error("unavailable"));
  const response = await GET(new Request("https://campus.syu.kr/api/service-notices"));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "서비스 공지를 불러오지 못했습니다." });
  logged.mockRestore();
});
it("falls back to Korean for an unsupported locale", async () => {
  await GET(new Request("https://campus.syu.kr/api/service-notices?locale=other"));
  expect(getAllServiceNotices).toHaveBeenCalledWith("ko");
});
