// @vitest-environment node
import sharp from "sharp";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeStudentRestaurantImage } from "./student-restaurant-openai";

const { create, construct } = vi.hoisted(() => ({ create: vi.fn(), construct: vi.fn() }));
vi.mock("openai", () => ({ default: class {
  responses = { create };
  constructor(options: unknown) { construct(options); }
} }));
const image = { bytes: Buffer.alloc(0), contentType: "image/png", lastModified: "2026-10-11T22:39:00Z" };
const extraction = { reliable: true, year: null, days: [{ month: 10, day: 12, weekday: 1, breakfast: [], lunch: ["테스트 메뉴"], dinner: null }] };
const options = { apiKey: "mock-key", now: new Date("2026-10-15T00:00:00Z") };
beforeAll(async () => {
  const pixels = Buffer.alloc(40 * 12 * 3);
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 40; x++) {
      const color = x >= 19 && x <= 20 || y >= 5 && y <= 6 ? [0, 0, 255]
        : y < 5 ? x < 19 ? [255, 0, 0] : [0, 255, 0] : x < 19 ? [255, 255, 0] : [255, 0, 255];
      pixels.set(color, (y * 40 + x) * 3);
    }
  }
  image.bytes = await sharp(pixels, { raw: { width: 40, height: 12, channels: 3 } }).png().toBuffer();
});
beforeEach(() => { vi.clearAllMocks(); create.mockResolvedValue({ status: "completed", output: [], output_text: JSON.stringify(extraction) }); });

describe("Manna House OpenAI extraction", () => {
  it("uses Responses strict Structured Outputs and only an in-memory data URL", async () => {
    const result = await analyzeStudentRestaurantImage(image, { ...options, model: "configured-model" });
    expect(result).toEqual({ updatedAt: options.now.toISOString(), weekStart: "2026-10-12", days: [{ date: "2026-10-12", breakfast: [], lunch: ["테스트 메뉴"], dinner: null }] });
    expect(construct).toHaveBeenCalledWith(expect.objectContaining({ logLevel: "off", baseURL: "https://api.openai.com/v1" }));
    const request = create.mock.calls[0][0];
    expect(request).toMatchObject({ model: "configured-model", store: false, text: { format: { type: "json_schema", strict: true } } });
    expect(request.reasoning).toBeUndefined();
    expect(request.input[0].content[1]).toEqual({ type: "input_image", image_url: `data:image/png;base64,${image.bytes.toString("base64")}`, detail: "high" });
    expect(JSON.stringify(request)).not.toMatch(/source\.invalid|uploadFileName|apiUrl/);
  });
  it("sends the original plus four overlapping 3x PNG quadrants without source metadata", async () => {
    await analyzeStudentRestaurantImage(image, options);
    const content = create.mock.calls[0][0].input[0].content;
    const images = content.filter((part: { type: string }) => part.type === "input_image");
    expect(images).toHaveLength(5);
    for (const [index, label] of ["상단 왼쪽", "상단 오른쪽", "하단 왼쪽", "하단 오른쪽"].entries()) {
      expect(content[2 + index * 2].text).toContain(label);
    }
    expect(create.mock.calls[0][0].instructions).toContain("중복 생성하지 않는다");
    expect(create.mock.calls[0][0].instructions).toContain("판독 가능한 메뉴를 null로 처리하지 않는다");
    for (const [index, part] of images.slice(1).entries()) {
      expect(part.image_url).toMatch(/^data:image\/png;base64,/);
      const bytes = Buffer.from(part.image_url.split(",")[1], "base64");
      expect(await sharp(bytes).metadata()).toMatchObject({ format: "png", width: 63, height: 21 });
      const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
      const corners = [0, info.width - 1, (info.height - 1) * info.width, info.width * info.height - 1]
        .map((pixel) => [...data.subarray(pixel * info.channels, pixel * info.channels + 3)]);
      const blue = [0, 0, 255];
      expect(corners).toEqual([
        [[255, 0, 0], blue, blue, blue],
        [blue, [0, 255, 0], blue, blue],
        [blue, blue, [255, 255, 0], blue],
        [blue, blue, blue, [255, 0, 255]],
      ][index]);
    }
    expect(JSON.stringify(create.mock.calls[0][0])).not.toContain(image.lastModified);
  });
  it("rejects invalid or oversized encoded and decoded images before calling the API", async () => {
    const tooManyPixels = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "white" } }).png().toBuffer();
    for (const bytes of [Buffer.from("invalid private source image"), Buffer.alloc(10 * 1024 * 1024 + 1), tooManyPixels]) {
      await expect(analyzeStudentRestaurantImage({ ...image, bytes }, options)).rejects.toThrow(/^STUDENT_RESTAURANT_ANALYSIS_FAILED$/);
    }
    expect(create).not.toHaveBeenCalled();
  });
  it("extracts both weeks and resolves the year from image modification metadata, independent of execution time", async () => {
    create.mockResolvedValue({ status: "completed", output: [], output_text: JSON.stringify({
      ...extraction, days: [{ ...extraction.days[0], day: 19 }, extraction.days[0]],
    }) });
    const result = await analyzeStudentRestaurantImage(image, { ...options, now: new Date("2030-01-01T00:00:00Z") });
    expect(result.weekStart).toBe("2026-10-12");
    expect(result.days.map((day) => day.date)).toEqual(["2026-10-12", "2026-10-19"]);
    expect(create.mock.calls[0][0]).toMatchObject({ model: "gpt-5.4", reasoning: { effort: "high" }, max_output_tokens: 20000 });
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
