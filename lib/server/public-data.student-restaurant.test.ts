// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";

const source = vi.hoisted(() => ({ enabled: vi.fn(), active: vi.fn(), read: vi.fn(), file: vi.fn() }));
vi.mock("./public-data-storage", () => ({ publicDataFirebaseEnabled: source.enabled, getActivePublicData: source.active, readFirebasePublicData: source.read }));
vi.mock("node:fs/promises", () => ({ readFile: source.file }));
import { readPublicDataBundle } from "./public-data";

const file = "student-restaurant-1.json";
const publicUrl = "https://example.github.io/cafeteria/student-restaurant-1.json";
const menu = {
  updatedAt: "2026-10-26T00:00:00Z", weekStart: "2026-10-26",
  days: [{ date: "2026-10-26", breakfast: null, lunch: ["김치볶음밥"], dinner: [] }],
};

beforeEach(() => {
  source.enabled.mockReset().mockReturnValue(false);
  source.active.mockReset().mockResolvedValue({ manifest: { version: "firebase-menu" } });
  source.read.mockReset().mockResolvedValue({ data: menu });
  source.file.mockReset().mockRejectedValue(Object.assign(new Error("absent"), { code: "ENOENT" }));
  vi.stubEnv("NEXT_PUBLIC_CAFETERIA_JSON_URL", publicUrl);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(menu)));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Manna data backend and fallback", () => {
  it("reads the active Firebase menu without a legacy URL or external fallback request", async () => {
    source.enabled.mockReturnValue(true);
    vi.stubEnv("NEXT_PUBLIC_CAFETERIA_JSON_URL", "");
    expect(await readPublicDataBundle([file])).toEqual({ source: "firebase-storage", version: "firebase-menu", data: { [file]: menu } });
    expect(source.file).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([false, true])("retains the validated legacy fallback when a bundle is absent (Firebase=%s)", async (enabled) => {
    source.enabled.mockReturnValue(enabled);
    source.read.mockRejectedValue(new Error("storage unavailable"));
    expect(await readPublicDataBundle([file])).toEqual({ source: "bundled-fallback", version: "bundled", data: { [file]: menu } });
    expect(source.file).toHaveBeenCalledTimes(enabled ? 2 : 1);
    expect(fetch).toHaveBeenCalledWith(new URL(publicUrl), expect.objectContaining({ credentials: "omit", redirect: "error", referrerPolicy: "no-referrer", cache: "no-store" }));
  });

  it("prefers a valid local fallback over the old remote URL", async () => {
    source.file.mockResolvedValue(JSON.stringify(menu));
    expect((await readPublicDataBundle([file])).data[file]).toEqual(menu);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([publicUrl, ""])("recovers from Firebase and Pages failure with the packaged menu (legacy URL=%s)", async (legacyUrl) => {
    const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const fallbackPath = path.join(process.cwd(), "data-source", "fallbacks", file);
    const content = await fs.readFile(fallbackPath, "utf8");
    source.enabled.mockReturnValue(true);
    source.read.mockRejectedValue(new Error("storage unavailable"));
    source.file.mockRejectedValueOnce(Object.assign(new Error("absent"), { code: "ENOENT" })).mockResolvedValueOnce(content);
    vi.stubEnv("NEXT_PUBLIC_CAFETERIA_JSON_URL", legacyUrl);
    vi.mocked(fetch).mockRejectedValue(new Error("Pages unavailable"));
    expect(await readPublicDataBundle([file])).toEqual({ source: "bundled-fallback", version: "bundled", data: { [file]: JSON.parse(content) } });
    expect(source.file).toHaveBeenNthCalledWith(1, path.join(process.cwd(), "public", "cafeteria", file), "utf8");
    expect(source.file).toHaveBeenNthCalledWith(2, fallbackPath, "utf8");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["{}", Object.assign(new Error("denied"), { code: "EACCES" })])("fails closed for an invalid or unreadable server fallback", async (failure) => {
    source.enabled.mockReturnValue(true);
    source.read.mockRejectedValue(new Error("storage unavailable"));
    source.file.mockRejectedValueOnce(Object.assign(new Error("absent"), { code: "ENOENT" }));
    if (typeof failure === "string") source.file.mockResolvedValueOnce(failure);
    else source.file.mockRejectedValueOnce(failure);
    await expect(readPublicDataBundle([file])).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a same-service Firebase fallback before it can recurse", async () => {
    source.enabled.mockReturnValue(true);
    source.read.mockRejectedValue(new Error("storage unavailable"));
    vi.stubEnv("NEXT_PUBLIC_CAFETERIA_JSON_URL", "https://campus.syu.kr/cafeteria/student-restaurant-1.json");
    await expect(readPublicDataBundle([file])).rejects.toThrow("must not point to this API");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails without an external request when Firebase and every configured fallback are unavailable", async () => {
    source.enabled.mockReturnValue(true);
    source.read.mockRejectedValue(new Error("storage unavailable"));
    vi.stubEnv("NEXT_PUBLIC_CAFETERIA_JSON_URL", "");
    await expect(readPublicDataBundle([file])).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([Response.json({ ...menu, days: [{ date: "2026-10-26", lunch: ["incomplete"] }] }), new Response("unavailable", { status: 503 })])("does not turn an invalid or failed fallback into a successful menu", async (response) => {
    vi.mocked(fetch).mockResolvedValueOnce(response);
    await expect(readPublicDataBundle([file])).rejects.toThrow();
  });
});
