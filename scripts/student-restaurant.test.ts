// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collectStudentRestaurant, downloadStudentRestaurantImage, parseStudentRestaurantApiUrl, studentRestaurantHash, studentRestaurantImageUrl } from "./student-restaurant";

const apiUrl = new URL("https://source.invalid/mobileapp/shop/165");
const source = (uploadFileName = "/uploadimages/sikdan/fixture.png") => ({
  shopEntities: [{ shopId: 999, menuLinkType: { code: "TEXT" } }, { shopId: 165, menuLinkType: { code: "IMAGE" }, uploadFileName }],
});
const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]);
const menu = {
  updatedAt: "2026-10-15T00:00:00Z", weekStart: "2026-10-12",
  days: [{ date: "2026-10-12", breakfast: [], lunch: ["테스트 메뉴"], dinner: null }],
};
let root: string;
let outputPath: string;
let statePath: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "manna-menu-"));
  outputPath = path.join(root, "public", "cafeteria", "student-restaurant-1.json");
  statePath = path.join(root, "private", "state.json");
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

function requests(bytes = image) {
  return vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify(source()), { headers: { "content-type": "application/json" } }))
    .mockResolvedValueOnce(new Response(bytes, { headers: { "content-type": "image/png" } }));
}

describe("Manna House source security", () => {
  it("selects the intended shop and builds a same-origin image URL", () => {
    expect(studentRestaurantImageUrl(source(), apiUrl).href).toBe("https://source.invalid/uploadimages/sikdan/fixture.png");
  });
  it.each(["https://other.invalid/uploadimages/sikdan/a.png", "//other.invalid/a.png", "/uploadimages/sikdan/../a.png", "/uploadimages/sikdan/%2e%2e.png", "/uploadimages/sikdan/a.svg", "/uploadimages/sikdan/a.png?next=x", "/private/a.png", "\\other.invalid\\a.png", ""])("rejects unsafe image path %s", (value) => {
    expect(() => studentRestaurantImageUrl(source(value), apiUrl)).toThrow("INVALID_STUDENT_RESTAURANT_SOURCE");
  });
  it("rejects malformed JSON structures, missing/duplicate shops and non-image menus", () => {
    for (const value of [null, {}, { shopEntities: [] }, { shopEntities: [source().shopEntities[1], source().shopEntities[1]] }, { shopEntities: [{ shopId: 165, menuLinkType: { code: "TEXT" }, uploadFileName: "/uploadimages/sikdan/fixture.png" }] }]) {
      expect(() => studentRestaurantImageUrl(value, apiUrl)).toThrow();
    }
  });
  it.each(["file:///tmp/menu", "https://user:password@source.invalid/menu", "invalid"])("rejects invalid configured URL without echoing it", (value) => {
    expect(() => parseStudentRestaurantApiUrl(value)).toThrow("INVALID_HAKSIK_API_URL");
  });
  it("sets redirect rejection, timeout and bounded types, and accepts explicit HTTP configuration", async () => {
    const request = requests();
    await downloadStudentRestaurantImage(apiUrl, request);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][1]).toMatchObject({ redirect: "error", cache: "no-store", signal: expect.any(AbortSignal) });
    expect(parseStudentRestaurantApiUrl("http://source.invalid/menu").protocol).toBe("http:");
  });
  it.each([
    new Response("failed", { status: 500 }),
    new Response("not json", { headers: { "content-type": "application/json" } }),
    new Response("{}", { headers: { "content-type": "text/html" } }),
    new Response("{}", { headers: { "content-type": "application/json", "content-length": String(1024 * 1024 + 1) } }),
  ])("rejects invalid API responses", async (response) => {
    await expect(downloadStudentRestaurantImage(apiUrl, vi.fn().mockResolvedValue(response))).rejects.toThrow();
  });
  it("rejects oversized streaming content, invalid image bytes and HTML disguised as an image", async () => {
    for (const response of [
      new Response(new Uint8Array(10 * 1024 * 1024 + 1), { headers: { "content-type": "image/png" } }),
      new Response("<html>private</html>", { headers: { "content-type": "image/png" } }),
      new Response(image, { headers: { "content-type": "text/html" } }),
    ]) {
      const request = requests(); request.mockReset().mockResolvedValueOnce(new Response(JSON.stringify(source()), { headers: { "content-type": "application/json" } })).mockResolvedValueOnce(response);
      await expect(downloadStudentRestaurantImage(apiUrl, request)).rejects.toThrow();
    }
  });
  it("sanitizes network errors", async () => {
    const request = vi.fn().mockRejectedValue(new Error("https://source.invalid/private Authorization: secret"));
    await expect(downloadStudentRestaurantImage(apiUrl, request)).rejects.toThrow(/^STUDENT_RESTAURANT_DOWNLOAD_FAILED$/);
  });
});

describe("Manna House collection", () => {
  it("analyzes first run, hashes bytes, and skips only a matching successful output pair", async () => {
    const analyze = vi.fn().mockResolvedValue(menu);
    const options = { apiUrl, outputPath, statePath, analyze };
    await expect(collectStudentRestaurant({ ...options, request: requests() })).resolves.toBe("updated");
    const before = await readFile(outputPath, "utf8");
    expect(JSON.parse(before)).toEqual(menu);
    expect(JSON.parse(await readFile(statePath, "utf8"))).toEqual({ imageHash: studentRestaurantHash(image), outputHash: studentRestaurantHash(before) });
    await expect(collectStudentRestaurant({ ...options, request: requests() })).resolves.toBe("unchanged");
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(await readFile(outputPath, "utf8")).toBe(before);
    expect(before).not.toMatch(/source\.invalid|imageHash|outputHash|uploadFileName|base64/);
  });
  it("detects changed bytes even at the same image path", async () => {
    const analyze = vi.fn().mockResolvedValue(menu);
    const options = { apiUrl, outputPath, statePath, analyze };
    await collectStudentRestaurant({ ...options, request: requests() });
    await collectStudentRestaurant({ ...options, request: requests(Buffer.concat([image, Buffer.from([2])])) });
    expect(analyze).toHaveBeenCalledTimes(2);
  });
  it("analyzes again when public output is missing or does not match the private checkpoint", async () => {
    const analyze = vi.fn().mockResolvedValue(menu);
    const options = { apiUrl, outputPath, statePath, analyze };
    await collectStudentRestaurant({ ...options, request: requests() });
    await writeFile(outputPath, "{}");
    await collectStudentRestaurant({ ...options, request: requests() });
    await rm(outputPath);
    await collectStudentRestaurant({ ...options, request: requests() });
    expect(analyze).toHaveBeenCalledTimes(3);
  });
  it("keeps previous JSON and success hash when analysis fails or dates are invalid", async () => {
    const options = { apiUrl, outputPath, statePath };
    await collectStudentRestaurant({ ...options, analyze: async () => menu, request: requests() });
    const before = await readFile(outputPath, "utf8");
    const state = await readFile(statePath, "utf8");
    const changed = Buffer.concat([image, Buffer.from([2])]);
    for (const analyze of [vi.fn().mockRejectedValue(new Error("analysis failed")), vi.fn().mockResolvedValue({ ...menu, weekStart: "unknown" }), vi.fn().mockResolvedValue({ ...menu, days: [] }), vi.fn().mockResolvedValue({ ...menu, days: [{ ...menu.days[0], lunch: null, breakfast: null }] })]) {
      await expect(collectStudentRestaurant({ ...options, analyze, request: requests(changed) })).rejects.toThrow();
      expect(await readFile(outputPath, "utf8")).toBe(before);
      expect(await readFile(statePath, "utf8")).toBe(state);
    }
  });
});
