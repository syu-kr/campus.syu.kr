import { beforeEach, expect, it, vi } from "vitest";
const read = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/public-data", () => ({ readPublicDataBundle: read }));
import { GET } from "./route";
beforeEach(() => { read.mockReset().mockResolvedValue({ data: { "phone-numbers.json": [{ department: "Office", phone: "123" }] }, source: "firebase-storage", version: "test-version" }); });
const params = (fileName: string) => ({ params: Promise.resolve({ fileName }) });
it("rejects unknown or private paths before reading storage", async () => {
  for (const file of ["../private.json", "secrets.json", "manifest.json"]) expect((await GET(new Request("https://campus.syu.kr/api/public-data/x"), params(file))).status).toBe(404);
  expect(read).not.toHaveBeenCalled();
});
it("preserves JSON values and conditionally returns the same public ETag", async () => {
  const request = new Request("https://campus.syu.kr/api/public-data/phone-numbers.json");
  const response = await GET(request, params("phone-numbers.json"));
  expect(response.headers.get("x-public-data-version")).toBe("test-version");
  expect(await response.json()).toEqual([{ department: "Office", phone: "123" }]);
  const cached = await GET(new Request(request, { headers: { "If-None-Match": response.headers.get("etag")! } }), params("phone-numbers.json"));
  expect(cached.status).toBe(304); expect(await cached.text()).toBe("");
});
it("uses a user-facing failure without exposing provider diagnostics", async () => {
  read.mockRejectedValue(new Error("private provider diagnostic"));
  const response = await GET(new Request("https://campus.syu.kr/api/public-data/phone-numbers.json"), params("phone-numbers.json"));
  expect(response.status).toBe(503); expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.text()).not.toContain("private provider diagnostic");
});
