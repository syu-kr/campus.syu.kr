// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/server/managed-media", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/server/managed-media")>(), readManagedImage: mocks.read }));
import { ApiError } from "@/lib/server/http";
import { GET } from "./route";
const id = "f07dba03-8cda-4a95-b8cc-111111111111";
beforeEach(() => mocks.read.mockReset().mockResolvedValue({ data: new Uint8Array([1, 2, 3]), etag: '"hash"' }));
it("serves only WebP with browser revalidation, short shared-cache freshness and a content ETag", async () => {
  const result = await GET(new Request(`https://campus.test/api/content-media/${id}`), { params: Promise.resolve({ id }) });
  expect(result.status).toBe(200);expect(result.headers.get("Content-Type")).toBe("image/webp");expect(result.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(result.headers.get("Cache-Control")).toBe("public, max-age=0, s-maxage=60, must-revalidate");expect((await result.arrayBuffer()).byteLength).toBe(3);expect(mocks.read).toHaveBeenCalledWith(id, null);
});
it("honors a matching validator without retransmitting the image", async () => {
  const etag = `"${"a".repeat(64)}-g1001"`;
  mocks.read.mockResolvedValueOnce({ data: null, etag });
  const result = await GET(new Request(`https://campus.test/api/content-media/${id}`, { headers: { "If-None-Match": etag } }), { params: Promise.resolve({ id }) });
  expect(result.status).toBe(304);expect(await result.text()).toBe("");
  expect(mocks.read).toHaveBeenCalledWith(id, etag);
  expect(result.headers.get("ETag")).toBe(etag);expect(result.headers.get("Content-Type")).toBe("image/webp");
  expect(result.headers.get("Cache-Control")).toBe("public, max-age=0, s-maxage=60, must-revalidate");expect(result.headers.get("X-Content-Type-Options")).toBe("nosniff");
});
it("still returns 304 for legacy images whose downloaded bytes match", async () => {
  const result = await GET(new Request(`https://campus.test/api/content-media/${id}`, { headers: { "If-None-Match": '"hash"' } }), { params: Promise.resolve({ id }) });
  expect(result.status).toBe(304);expect(await result.text()).toBe("");
});
it("returns the validated body when the content ETag differs", async () => {
  const result = await GET(new Request(`https://campus.test/api/content-media/${id}`, { headers: { "If-None-Match": '"old"' } }), { params: Promise.resolve({ id }) });
  expect(result.status).toBe(200);expect((await result.arrayBuffer()).byteLength).toBe(3);
});
it("does not return 304 for a deleted image even when the client still has its ETag", async () => {
  mocks.read.mockRejectedValueOnce(new ApiError("missing", 404));
  const result = await GET(new Request(`https://campus.test/api/content-media/${id}`, { headers: { "If-None-Match": '"hash"' } }), { params: Promise.resolve({ id }) });
  expect(mocks.read).toHaveBeenCalledWith(id, '"hash"');
  expect(result.status).toBe(404);expect(result.headers.get("Cache-Control")).toBe("no-store");expect(result.headers.get("ETag")).toBeNull();
});
it("keeps missing and failed media responses uncached and generic", async () => {
  mocks.read.mockRejectedValueOnce(new ApiError("missing", 404));let result = await GET(new Request("https://campus.test/image"), { params: Promise.resolve({ id: "invalid" }) });
  expect(result.status).toBe(404);expect(result.headers.get("Cache-Control")).toBe("no-store");
  mocks.read.mockRejectedValueOnce(new Error("private credential"));result = await GET(new Request("https://campus.test/image"), { params: Promise.resolve({ id }) });
  expect(result.status).toBe(503);expect(result.headers.get("Cache-Control")).toBe("no-store");expect(await result.text()).not.toContain("private");
});
