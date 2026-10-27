// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), configured: vi.fn(), read: vi.fn(), seeds: vi.fn(), mutate: vi.fn(), rate: vi.fn(), tag: vi.fn(), path: vi.fn() }));
vi.mock("@/lib/server/admin-auth", async original => ({ ...await original<typeof import("@/lib/server/admin-auth")>(), requireAdmin: mocks.auth }));
vi.mock("@/lib/server/managed-content", async original => ({ ...await original<typeof import("@/lib/server/managed-content")>(), readManagedContentRecords: mocks.read, requireManagedContentConfigured: mocks.configured, mutateManagedContent: mocks.mutate }));
vi.mock("@/lib/serviceNotices", () => ({ getRepositoryManagedContent: mocks.seeds }));
vi.mock("@/lib/server/http", async original => ({ ...await original<typeof import("@/lib/server/http")>(), enforceRateLimit: mocks.rate }));
vi.mock("next/cache", () => ({ revalidateTag: mocks.tag, revalidatePath: mocks.path, unstable_cache: (fn: unknown) => fn }));
import { AdminAuthError } from "@/lib/server/admin-auth";
import { ApiError } from "@/lib/server/http";
import { GET, POST } from "./route";
const draft = { kind: "notice", slug: "test", title: "새 공지", summary: "", content: "본문", startsAt: null, endsAt: null };
const item = { id: "test", draft, published: null, revision: 1, updatedAt: "2026-10-26T00:00:00Z", publishedAt: null, archived: false, source: "database" };
const request = (body: unknown, origin = "https://campus.test") => new Request("https://campus.test/api/admin/content", { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });
beforeEach(() => { Object.values(mocks).forEach(fn => fn.mockReset());mocks.auth.mockResolvedValue({ uid: "admin" });mocks.read.mockResolvedValue([]);mocks.seeds.mockResolvedValue([]);mocks.mutate.mockResolvedValue(item); });

it("checks administrator authorization before reads, writes or private data", async () => {
  mocks.auth.mockRejectedValue(new AdminAuthError("권한이 없습니다", 403));
  expect((await GET(new Request("https://campus.test/api/admin/content"))).status).toBe(403);
  expect((await POST(request({}))).status).toBe(403);
  expect(mocks.read).not.toHaveBeenCalled();expect(mocks.seeds).not.toHaveBeenCalled();expect(mocks.mutate).not.toHaveBeenCalled();
});
it("merges stored overrides with repository seed records without duplicate IDs", async () => {
  mocks.seeds.mockResolvedValue([{ ...item, source: "repository", revision: 0 }]);mocks.read.mockResolvedValue([item]);
  const response = await GET(new Request("https://campus.test/api/admin/content"));
  expect((await response.json()).items).toEqual([item]);expect(response.headers.get("cache-control")).toContain("no-store");
});
it("does not interpret missing backend configuration as an empty dashboard", async () => {
  mocks.configured.mockImplementation(() => { throw new ApiError("설정을 확인해 주세요", 503); });
  expect((await GET(new Request("https://campus.test/api/admin/content"))).status).toBe(503);expect(mocks.read).not.toHaveBeenCalled();
});
it("rejects cross-origin and malformed requests before mutation", async () => {
  expect((await POST(request({ id: "test", expectedRevision: 0, action: "save", draft }, "https://other.test"))).status).toBe(403);
  expect((await POST(request({ text: "arbitrary" }))).status).toBe(400);expect(mocks.mutate).not.toHaveBeenCalled();
});
it("keeps draft saves private and invalidates all public publication views after publishing", async () => {
  const seed = { ...item, revision: 0, source: "repository" };mocks.seeds.mockResolvedValue([seed]);
  const saved = await POST(request({ id: "test", expectedRevision: 0, action: "save", draft }));
  expect(saved.status).toBe(200);expect(mocks.tag).not.toHaveBeenCalled();
  await POST(request({ id: "test", expectedRevision: 1, action: "publish", draft }));
  expect(mocks.tag).toHaveBeenCalledWith("site-managed-content-v2", { expire: 0 });expect(mocks.path).toHaveBeenCalledWith("/", "layout");
  expect(mocks.mutate.mock.calls[0][1]).toEqual(seed);
});
it("reports stale revisions and uncertain writes without exposing backend errors", async () => {
  mocks.mutate.mockRejectedValueOnce(new ApiError("다른 변경이 저장되었습니다", 409, undefined, "CONTENT_CONFLICT"));
  expect((await POST(request({ id: "test", expectedRevision: 0, action: "save", draft }))).status).toBe(409);
  mocks.mutate.mockRejectedValueOnce(new Error("sensitive credential"));const response = await POST(request({ id: "test", expectedRevision: 0, action: "save", draft }));
  expect(response.status).toBe(503);expect(await response.text()).not.toContain("sensitive");
});
