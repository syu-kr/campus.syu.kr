// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collectStudentRestaurant, downloadStudentRestaurantImage, parseStudentRestaurantApiUrl, parseStudentRestaurantReview, reviewedStudentRestaurantMenu, studentRestaurantHash, studentRestaurantImageUrl, type StudentRestaurantImage } from "./student-restaurant";

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
afterEach(async () => { vi.useRealTimers(); await rm(root, { recursive: true, force: true }); });

function requests(bytes = image, lastModified?: string) {
  return vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify(source()), { headers: { "content-type": "application/json" } }))
    .mockResolvedValueOnce(new Response(bytes, { headers: { "content-type": "image/png", ...(lastModified ? { "last-modified": lastModified } : {}) } }));
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
    ["Sun, 11 Oct 2026 22:39:00 GMT", "2026-10-11T22:39:00.000Z"],
    [undefined, null],
    ["invalid", null],
    ["Mon, 30 Feb 2026 00:00:00 GMT", null],
  ])("carries only a valid image Last-Modified timestamp (%s)", async (header, expected) => {
    const result = await downloadStudentRestaurantImage(apiUrl, requests(image, header));
    expect(result).toEqual({ bytes: image, contentType: "image/png", lastModified: expected });
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

describe("Manna House source-bound review", () => {
  const reviewEvent = {
    inputs: { reviewed_menu_json: JSON.stringify(menu), reviewed_image_sha256: studentRestaurantHash(image) },
  };
  const header = "Sun, 11 Oct 2026 22:39:00 GMT";

  it("accepts no review for ordinary manual runs and parses only the two explicit review inputs", () => {
    for (const event of [{}, { inputs: {} }, { inputs: { reviewed_menu_json: " ", reviewed_image_sha256: " " } }]) {
      expect(parseStudentRestaurantReview(event)).toBeUndefined();
    }
    expect(parseStudentRestaurantReview(reviewEvent)).toEqual({ menu, imageHash: studentRestaurantHash(image) });
    expect(parseStudentRestaurantReview({ inputs: { ...reviewEvent.inputs, reviewed_image_sha256: studentRestaurantHash(image).toUpperCase() } }))
      .toEqual({ menu, imageHash: studentRestaurantHash(image) });
  });

  it.each([
    { inputs: { reviewed_menu_json: JSON.stringify(menu) } },
    { inputs: { reviewed_image_sha256: studentRestaurantHash(image) } },
    { inputs: { ...reviewEvent.inputs, reviewed_image_sha256: "not-a-sha256" } },
    { inputs: { ...reviewEvent.inputs, reviewed_menu_json: "private invalid JSON" } },
    { inputs: { ...reviewEvent.inputs, reviewed_menu_json: JSON.stringify({ ...menu, days: [{ date: "2026-10-12" }] }) } },
    { inputs: { ...reviewEvent.inputs, reviewed_menu_json: JSON.stringify({ ...menu, weekStart: "2026-10-13" }) } },
    { inputs: { ...reviewEvent.inputs, reviewed_menu_json: JSON.stringify({ ...menu, days: [{ ...menu.days[0], lunch: ["https://private.invalid"] }] }) } },
    { inputs: { ...reviewEvent.inputs, reviewed_menu_json: 123 } },
  ])("rejects partial, malformed or unsafe review input without echoing its contents", (event) => {
    expect(() => parseStudentRestaurantReview(event)).toThrow(/^INVALID_STUDENT_RESTAURANT_REVIEW$/);
  });

  it("replaces an already cached OCR result once and skips AI on the next unchanged automatic run", async () => {
    const options = { apiUrl, outputPath, statePath, analysisContext: "fixture-model" };
    await collectStudentRestaurant({ ...options, analyze: async () => menu, request: requests(image, header) });
    const reviewed = { ...menu, days: [{ ...menu.days[0], lunch: ["검수한/원문(쨩)"], ingredients: { breakfast: null, lunch: ["콩,밀", "콩,밀"], dinner: null } }] };
    const review = parseStudentRestaurantReview({ inputs: { ...reviewEvent.inputs, reviewed_menu_json: JSON.stringify(reviewed) } })!;
    const now = new Date("2026-10-16T00:00:00Z");
    const analyze = vi.fn(async (downloaded: StudentRestaurantImage) => reviewedStudentRestaurantMenu(review, downloaded, now));
    await expect(collectStudentRestaurant({ ...options, forceAnalysis: true, analyze, request: requests(image, header) })).resolves.toBe("updated");
    expect(analyze).toHaveBeenCalledTimes(1);
    const published = await readFile(outputPath, "utf8");
    expect(JSON.parse(published)).toEqual({ ...reviewed, updatedAt: now.toISOString() });
    expect(published).not.toMatch(/reviewed_|imageHash|lastModified|source\.invalid|base64/);
    const state = await readFile(statePath, "utf8");
    const automaticAnalyze = vi.fn().mockRejectedValue(new Error("AI must not run for the reviewed image"));
    await expect(collectStudentRestaurant({ ...options, analyze: automaticAnalyze, request: requests(image, header) })).resolves.toBe("unchanged");
    expect(automaticAnalyze).not.toHaveBeenCalled();
    expect(await readFile(outputPath, "utf8")).toBe(published);
    expect(await readFile(statePath, "utf8")).toBe(state);
  });

  it("preserves the previous public JSON and checkpoint on a review source, date or schema mismatch", async () => {
    const options = { apiUrl, outputPath, statePath, analysisContext: "fixture-model" };
    await collectStudentRestaurant({ ...options, analyze: async () => menu, request: requests(image, header) });
    const published = await readFile(outputPath, "utf8");
    const state = await readFile(statePath, "utf8");
    const review = parseStudentRestaurantReview(reviewEvent)!;
    const oldMenu = { ...menu, weekStart: "2020-10-12", days: [{ ...menu.days[0], date: "2020-10-12" }] };
    const cases = [
      { review, bytes: Buffer.concat([image, Buffer.from([2])]), header },
      { review: { ...review, menu: oldMenu }, bytes: image, header },
      { review, bytes: image, header: undefined },
      { review: { ...review, menu: { ...menu, weekStart: "invalid" } }, bytes: image, header },
    ];
    for (const entry of cases) {
      await expect(collectStudentRestaurant({
        ...options, forceAnalysis: true, request: requests(entry.bytes, entry.header),
        analyze: async (downloaded) => reviewedStudentRestaurantMenu(entry.review, downloaded),
      })).rejects.toThrow();
      expect(await readFile(outputPath, "utf8")).toBe(published);
      expect(await readFile(statePath, "utf8")).toBe(state);
    }
  });
});

describe("Manna House collection", () => {
  it("analyzes first run, hashes bytes, and skips only a matching successful output pair", async () => {
    const analyze = vi.fn().mockResolvedValue(menu);
    const options = { apiUrl, outputPath, statePath, analyze };
    await expect(collectStudentRestaurant({ ...options, request: requests(image, "Sun, 11 Oct 2026 22:39:00 GMT") })).resolves.toBe("updated");
    expect(analyze).toHaveBeenCalledWith({ bytes: image, contentType: "image/png", lastModified: "2026-10-11T22:39:00.000Z" });
    const before = await readFile(outputPath, "utf8");
    expect(JSON.parse(before)).toEqual(menu);
    expect(JSON.parse(await readFile(statePath, "utf8"))).toEqual({ analysisVersion: 4, imageHash: studentRestaurantHash(image), analysisContextHash: studentRestaurantHash(JSON.stringify(["2026-10-11T22:39:00.000Z", ""])), outputHash: studentRestaurantHash(before) });
    await expect(collectStudentRestaurant({ ...options, request: requests(image, "Sun, 11 Oct 2026 22:39:00 GMT") })).resolves.toBe("unchanged");
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(await readFile(outputPath, "utf8")).toBe(before);
    expect(before).not.toMatch(/source\.invalid|analysisVersion|lastModified|imageHash|analysisContextHash|outputHash|uploadFileName|base64/);
  });
  it.each([undefined, 1, 2, 3])("reanalyzes legacy checkpoints without the extraction context (%s)", async (analysisVersion) => {
    await collectStudentRestaurant({ apiUrl, outputPath, statePath, analyze: async () => menu, request: requests() });
    const previous = await readFile(outputPath, "utf8");
    await writeFile(statePath, JSON.stringify({ analysisVersion, imageHash: studentRestaurantHash(image), outputHash: studentRestaurantHash(previous) }));
    const analyze = vi.fn().mockResolvedValue(menu);
    await expect(collectStudentRestaurant({ apiUrl, outputPath, statePath, analyze, request: requests() })).resolves.toBe("updated");
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(JSON.parse(await readFile(statePath, "utf8")).analysisVersion).toBe(4);
  });
  it("reanalyzes unchanged image bytes when the date reference or model changes", async () => {
    const analyze = vi.fn().mockResolvedValue(menu);
    const options = { apiUrl, outputPath, statePath, analyze, analysisContext: "fixture-model-a" };
    const header = "Sun, 11 Oct 2026 22:39:00 GMT";
    const nextHeader = "Mon, 12 Oct 2026 22:39:00 GMT";
    await expect(collectStudentRestaurant({ ...options, request: requests(image, header) })).resolves.toBe("updated");
    await expect(collectStudentRestaurant({ ...options, request: requests(image, header) })).resolves.toBe("unchanged");
    expect(analyze).toHaveBeenCalledTimes(1);
    await expect(collectStudentRestaurant({ ...options, request: requests(image, nextHeader) })).resolves.toBe("updated");
    await expect(collectStudentRestaurant({ ...options, analysisContext: "fixture-model-b", request: requests(image, nextHeader) })).resolves.toBe("updated");
    expect(analyze).toHaveBeenCalledTimes(3);
    const checkpoint = await readFile(statePath, "utf8");
    expect(JSON.parse(checkpoint).analysisContextHash).toBe(studentRestaurantHash(JSON.stringify(["2026-10-12T22:39:00.000Z", "fixture-model-b"])));
    expect(checkpoint).not.toMatch(/fixture-model|2026-10-|GMT|lastModified/);
  });
  it("invalidates the previous analysis version even when image, context and output hashes match", async () => {
    const analyze = vi.fn().mockResolvedValue(menu);
    const options = { apiUrl, outputPath, statePath, analyze };
    await collectStudentRestaurant({ ...options, request: requests() });
    const checkpoint = JSON.parse(await readFile(statePath, "utf8"));
    await writeFile(statePath, JSON.stringify({ ...checkpoint, analysisVersion: 3 }));
    await expect(collectStudentRestaurant({ ...options, request: requests() })).resolves.toBe("updated");
    expect(analyze).toHaveBeenCalledTimes(2);
  });
  it("keeps both weeks cached when the unchanged image is collected in the next week", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T00:00:00Z"));
    const twoWeeks = { ...menu, days: [...menu.days, { ...menu.days[0], date: "2026-10-19", lunch: ["다음 주 메뉴"] }] };
    const analyze = vi.fn().mockResolvedValue(twoWeeks);
    const options = { apiUrl, outputPath, statePath, analyze };
    await expect(collectStudentRestaurant({ ...options, request: requests() })).resolves.toBe("updated");
    const before = await readFile(outputPath, "utf8");
    vi.setSystemTime(new Date("2026-10-19T00:00:00Z"));
    await expect(collectStudentRestaurant({ ...options, request: requests() })).resolves.toBe("unchanged");
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual(twoWeeks);
    expect(await readFile(outputPath, "utf8")).toBe(before);
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
