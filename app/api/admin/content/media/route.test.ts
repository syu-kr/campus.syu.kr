// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rate: vi.fn(), save: vi.fn(), available: vi.fn() }));
vi.mock("@/lib/server/admin-auth", async original => ({ ...await original<typeof import("@/lib/server/admin-auth")>(), requireAdmin: mocks.auth }));
vi.mock("@/lib/server/http", async original => ({ ...await original<typeof import("@/lib/server/http")>(), enforceRateLimit: mocks.rate }));
vi.mock("@/lib/server/managed-media", () => ({ MAX_MEDIA_INPUT: 5 * 1024 * 1024, saveManagedImage: mocks.save, isManagedMediaAvailable: mocks.available }));
import { AdminAuthError } from "@/lib/server/admin-auth";
import { ApiError } from "@/lib/server/http";
import { POST } from "./route";

function multipart(extraHeaders: Record<string, string> = {}, content = "fixture pixels") {
  return new Request("https://campus.test/api/admin/content/media", { method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=fixture-boundary", origin: "https://campus.test", ...extraHeaders }, body: `--fixture-boundary\r\nContent-Disposition: form-data; name="file"; filename="banner.png"\r\nContent-Type: image/png\r\n\r\n${content}\r\n--fixture-boundary--\r\n` });
}
beforeEach(() => { Object.values(mocks).forEach(fn => fn.mockReset());mocks.auth.mockResolvedValue({ uid: "admin" });mocks.available.mockResolvedValue(true);mocks.save.mockResolvedValue({ url: "/api/content-media/f07dba03-8cda-4a95-b8cc-111111111111", width: 100, height: 50 }); });
it("checks admin authorization before consuming any file bytes", async () => {
  mocks.auth.mockRejectedValue(new AdminAuthError("로그인이 필요합니다", 401));const req = multipart();
  expect((await POST(req)).status).toBe(401);expect(req.bodyUsed).toBe(false);expect(mocks.save).not.toHaveBeenCalled();
});
it("bounds and rate-limits uploads before decoding a multipart file", async () => {
  const oversized = await POST(multipart({ "Content-Length": String(6 * 1024 * 1024) }));expect(oversized.status).toBe(413);expect(mocks.save).not.toHaveBeenCalled();
  mocks.rate.mockRejectedValueOnce(new ApiError("요청이 많습니다", 429));const req = multipart();expect((await POST(req)).status).toBe(429);expect(req.bodyUsed).toBe(false);
});
it("rejects unsafe origins, non-file forms and unsupported body types", async () => {
  expect((await POST(multipart({ origin: "https://evil.test" }))).status).toBe(403);
  expect((await POST(new Request("https://campus.test/api/admin/content/media", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{}' }))).status).toBe(415);
  const empty = multipart({}, "");const response = await POST(empty);expect(response.status).toBe(413);expect(mocks.save).not.toHaveBeenCalled();
});
it("returns only the public same-origin media descriptor after sanitized image processing", async () => {
  const result = await POST(multipart());expect(result.status).toBe(200);expect(result.headers.get("Cache-Control")).toContain("no-store");
  expect(await result.json()).toEqual({ url: "/api/content-media/f07dba03-8cda-4a95-b8cc-111111111111", width: 100, height: 50 });
  expect(new TextDecoder().decode(mocks.save.mock.calls[0][0])).toBe("fixture pixels");
});
it("does not expose bucket errors or SDK details", async () => {
  mocks.save.mockRejectedValue(new Error("credential and private bucket"));const result = await POST(multipart());
  expect(result.status).toBe(503);expect(await result.text()).not.toContain("private bucket");
});
it("fails before decoding an image if its configured bucket is unavailable", async () => {
  mocks.available.mockResolvedValue(false);const req = multipart();const result = await POST(req);
  expect(result.status).toBe(503);expect(req.bodyUsed).toBe(false);expect(mocks.save).not.toHaveBeenCalled();
});
