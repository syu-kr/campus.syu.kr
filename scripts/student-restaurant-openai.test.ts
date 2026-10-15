// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { analyzeStudentRestaurantImage } from "./student-restaurant-openai";

const { create, construct } = vi.hoisted(() => ({ create: vi.fn(), construct: vi.fn() }));
vi.mock("openai", () => ({ default: class {
  responses = { create };
  constructor(options: unknown) { construct(options); }
} }));
const image = { bytes: Buffer.alloc(0), contentType: "image/png", lastModified: "2026-10-11T22:39:00Z" };
beforeAll(async () => {
  const pixels = Buffer.from(Array.from({ length: 80 }, (_, index) => [index % 10 * 25, Math.floor(index / 10) * 30, 0]).flat());
  image.bytes = await sharp(pixels, { raw: { width: 10, height: 8, channels: 3 } }).png().toBuffer();
});
const extraction = { reliable: true, year: null, days: [{ month: 10, day: 12, weekday: 1, breakfast: [], lunch: ["테스트 메뉴"], dinner: null, ingredients: { breakfast: null, lunch: ["원문 재료"], dinner: null } }] };
const options = { apiKey: "mock-key", now: new Date("2026-10-15T00:00:00Z") };
beforeEach(() => { vi.clearAllMocks(); create.mockResolvedValue({ status: "completed", output: [], output_text: JSON.stringify(extraction) }); });

describe("Manna House OpenAI extraction", () => {
  it("uses Responses strict Structured Outputs and only an in-memory data URL", async () => {
    const result = await analyzeStudentRestaurantImage(image, { ...options, model: "configured-model" });
    expect(result).toEqual({ updatedAt: options.now.toISOString(), weekStart: "2026-10-12", days: [{ date: "2026-10-12", breakfast: [], lunch: ["테스트 메뉴"], dinner: null, ingredients: extraction.days[0].ingredients }] });
    expect(construct).toHaveBeenCalledWith(expect.objectContaining({ logLevel: "off", baseURL: "https://api.openai.com/v1" }));
    const request = create.mock.calls[0][0];
    expect(request).toMatchObject({ model: "configured-model", store: false, text: { format: { type: "json_schema", strict: true } } });
    expect(request.reasoning).toBeUndefined();
    expect(request.input[0].content).toHaveLength(6);
    expect(create).toHaveBeenCalledTimes(1);
    expect(request.input[0].content[1]).toEqual({ type: "input_image", image_url: `data:image/png;base64,${image.bytes.toString("base64")}`, detail: "high" });
    expect(JSON.stringify(request)).not.toMatch(/source\.invalid|uploadFileName|apiUrl/);
    const tiles = request.input[0].content.slice(2);
    const firstPixels: number[][] = [];
    for (const tile of tiles) {
      expect(tile).toMatchObject({ type: "input_image", detail: "high" });
      const bytes = Buffer.from(tile.image_url.split(",")[1], "base64");
      const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
      expect(info).toMatchObject({ width: 12, height: 10 });
      expect(data.subarray(0, 3)).toEqual(data.subarray(3, 6));
      firstPixels.push(Array.from(data.subarray(0, 3)));
    }
    expect(firstPixels).toEqual([[0, 0, 0], [100, 0, 0], [0, 90, 0], [100, 90, 0]]);
  });
  it("preserves literal spelling and raw ingredients without normalizing or deduplicating", async () => {
    const reviewed = { ...extraction, days: [{ ...extraction.days[0], lunch: ["원문쨩/괄호(가)"], ingredients: { breakfast: null, lunch: ["콩,밀/계란", "콩,밀/계란"], dinner: null } }] };
    create.mockResolvedValueOnce({ status: "completed", output: [], output_text: JSON.stringify(reviewed) });
    const result = await analyzeStudentRestaurantImage(image, options);
    expect(result.days[0].lunch).toEqual(["원문쨩/괄호(가)"]);
    expect(result.days[0].ingredients).toEqual(reviewed.days[0].ingredients);
  });
  it.each([Buffer.from("invalid image"), Buffer.alloc(10 * 1024 * 1024 + 1)])("rejects invalid or oversized images before requesting analysis", async (bytes) => {
    await expect(analyzeStudentRestaurantImage({ ...image, bytes }, options)).rejects.toThrow(/^STUDENT_RESTAURANT_ANALYSIS_FAILED$/);
    expect(create).not.toHaveBeenCalled();
  });
  it("rejects a compressed image with excessive pixel dimensions before requesting analysis", async () => {
    const bytes = await sharp({ create: { width: 4001, height: 4001, channels: 3, background: "white" } }).png().toBuffer();
    await expect(analyzeStudentRestaurantImage({ ...image, bytes }, options)).rejects.toThrow(/^STUDENT_RESTAURANT_ANALYSIS_FAILED$/);
    expect(create).not.toHaveBeenCalled();
  });
  it("extracts both weeks and resolves the year from image modification metadata, independent of execution time", async () => {
    create.mockResolvedValue({ status: "completed", output: [], output_text: JSON.stringify({
      ...extraction, days: [{ ...extraction.days[0], day: 19 }, extraction.days[0]],
    }) });
    const result = await analyzeStudentRestaurantImage(image, { ...options, now: new Date("2030-01-01T00:00:00Z") });
    expect(result.weekStart).toBe("2026-10-12");
    expect(result.days.map((day) => day.date)).toEqual(["2026-10-12", "2026-10-19"]);
    expect(create.mock.calls[0][0]).toMatchObject({ model: "gpt-6.1-sol", reasoning: { effort: "high" }, max_output_tokens: 20000 });
    expect(create.mock.calls[0][0].input[0].content[1].detail).toBe("original");
  });
  it("resolves a year boundary using the printed weekday and image metadata", async () => {
    create.mockResolvedValue({ status: "completed", output: [], output_text: JSON.stringify({
      ...extraction, days: [{ ...extraction.days[0], month: 1, day: 1, weekday: 5 }],
    }) });
    const result = await analyzeStudentRestaurantImage({ ...image, lastModified: "2026-12-28T00:00:00Z" }, options);
    expect(result.days[0].date).toBe("2027-01-01");
    expect(result.weekStart).toBe("2026-12-28");
  });
  it("requires an image-printed year when modification metadata is unavailable", async () => {
    await expect(analyzeStudentRestaurantImage({ ...image, lastModified: null }, options)).rejects.toThrow(/^STUDENT_RESTAURANT_ANALYSIS_FAILED$/);
    create.mockResolvedValue({ status: "completed", output: [], output_text: JSON.stringify({ ...extraction, year: 2026 }) });
    expect((await analyzeStudentRestaurantImage({ ...image, lastModified: null }, options)).days[0].date).toBe("2026-10-12");
  });
  it.each([
    { ...extraction, year: 2020 },
    { ...extraction, days: [{ ...extraction.days[0], weekday: 2 }] },
    { ...extraction, days: [{ ...extraction.days[0], month: 2, day: 30 }] },
    { ...extraction, days: [{ ...extraction.days[0], month: 12, day: 7 }] },
  ])("rejects invented years, mismatched weekdays, impossible or distant dates", async (value) => {
    create.mockResolvedValue({ status: "completed", output: [], output_text: JSON.stringify(value) });
    await expect(analyzeStudentRestaurantImage(image, options)).rejects.toThrow(/^STUDENT_RESTAURANT_ANALYSIS_FAILED$/);
  });
  it.each([
    { status: "incomplete", output: [], output_text: JSON.stringify(extraction) },
    { status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "private source" }] }], output_text: JSON.stringify(extraction) },
    { status: "completed", output: [], output_text: "invalid json" },
    { status: "completed", output: [], output_text: JSON.stringify({ ...extraction, reliable: false }) },
    { status: "completed", output: [], output_text: JSON.stringify({ ...extraction, days: [] }) },
    { status: "completed", output: [], output_text: JSON.stringify({ ...extraction, days: [{ ...extraction.days[0], breakfast: null, lunch: null }] }) },
  ])("stops on refusal, uncertain dates, incomplete/unreadable data or malformed output", async (response) => {
    create.mockResolvedValue(response);
    await expect(analyzeStudentRestaurantImage(image, options)).rejects.toThrow(/^STUDENT_RESTAURANT_ANALYSIS_FAILED$/);
  });
  it("does not leak SDK errors", async () => {
    create.mockRejectedValue(new Error("request https://private.invalid image base64 Authorization secret"));
    await expect(analyzeStudentRestaurantImage(image, options)).rejects.toThrow(/^STUDENT_RESTAURANT_ANALYSIS_FAILED$/);
  });
});
