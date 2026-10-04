import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCampusTips, fetchPhoneNumbers } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe.each([
  ["phone directory", fetchPhoneNumbers],
  ["campus tips", fetchCampusTips],
] as const)("%s data loading", (_name, loadData) => {
  it("rejects failed requests instead of returning an empty list", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    await expect(loadData()).rejects.toThrow("503");
  });

  it("rejects malformed JSON instead of returning an empty list", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not json")));
    await expect(loadData()).rejects.toThrow();
  });
});
