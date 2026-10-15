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
async function tableImage(tables = 1, widths = [12, 12, 12]) {
  const tableWidth = widths.reduce((sum, width) => sum + width, 0);
  const width = tables * tableWidth + (tables - 1) * 12 + 1;
  const height = 24;
  const pixels = Buffer.alloc(width * height * 3, 255);
  for (let table = 0; table < tables; table++) {
    const offset = table * (tableWidth + 12);
    const boundaries = [offset];
    for (const columnWidth of widths) boundaries.push(boundaries.at(-1)! + columnWidth);
    for (let y = 0; y < height; y++) {
      for (let x = offset; x <= offset + tableWidth; x++) {
        const column = boundaries.findIndex((boundary) => boundary > x) - 1;
        const color = boundaries.includes(x) ? [0, 0, 0] : column === 0 ? [255, 255, 0] : column % 2 === 1 ? [255, 0, 0] : [0, 255, 0];
        pixels.set(color, (y * width + x) * 3);
      }
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
}
beforeAll(async () => { image.bytes = await tableImage(); });
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
  it("detects menu/ingredient pairs and joins only full-height 3x menu columns with meal labels", async () => {
    await analyzeStudentRestaurantImage(image, options);
    const content = create.mock.calls[0][0].input[0].content;
    const images = content.filter((part: { type: string }) => part.type === "input_image");
    expect(images).toHaveLength(2);
    expect(content[2].text).toContain("1번째 표의 1번째 요일 전체 높이 확대본");
    expect(create.mock.calls[0][0].instructions).toContain("중복 생성하지 않는다");
    expect(create.mock.calls[0][0].instructions).toContain("판독 가능한 메뉴를 null로 처리하지 않는다");
    for (const part of images.slice(1)) {
      expect(part.image_url).toMatch(/^data:image\/png;base64,/);
      const bytes = Buffer.from(part.image_url.split(",")[1], "base64");
      expect(await sharp(bytes).metadata()).toMatchObject({ format: "png", width: 72, height: 72 });
      const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
      for (const y of [3, 68]) {
        const colors = [18, 54].map((x) => {
          const pixel = (y * info.width + x) * info.channels;
          return [...data.subarray(pixel, pixel + 3)];
        });
        expect(colors).toEqual([[255, 255, 0], [255, 0, 0]]);
      }
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
  it("rejects undetected, unpaired or uneven table layouts before calling the API", async () => {
    for (const bytes of [
      await sharp({ create: { width: 40, height: 24, channels: 3, background: "white" } }).png().toBuffer(),
      await tableImage(1, [12, 12, 12, 12]),
      await tableImage(1, [12, 24, 12]),
    ]) {
      await expect(analyzeStudentRestaurantImage({ ...image, bytes }, options)).rejects.toThrow(/^STUDENT_RESTAURANT_ANALYSIS_FAILED$/);
    }
    expect(create).not.toHaveBeenCalled();
  });
  it("rejects output that omits a detected weekday", async () => {
    await expect(analyzeStudentRestaurantImage({ ...image, bytes: await tableImage(2) }, options)).rejects.toThrow(/^STUDENT_RESTAURANT_ANALYSIS_FAILED$/);
  });
  it("extracts both weeks and resolves the year from image modification metadata, independent of execution time", async () => {
    create.mockResolvedValue({ status: "completed", output: [], output_text: JSON.stringify({
      ...extraction, days: [{ ...extraction.days[0], day: 19 }, extraction.days[0]],
    }) });
    const result = await analyzeStudentRestaurantImage({ ...image, bytes: await tableImage(2) }, { ...options, now: new Date("2030-01-01T00:00:00Z") });
    expect(result.weekStart).toBe("2026-10-12");
    expect(result.days.map((day) => day.date)).toEqual(["2026-10-12", "2026-10-19"]);
    expect(create.mock.calls[0][0]).toMatchObject({ model: "gpt-5.4", reasoning: { effort: "high" }, max_output_tokens: 20000 });
    expect(create.mock.calls[0][0].input[0].content[1].detail).toBe("original");
    expect(create.mock.calls[0][0].input[0].content.filter((part: { type: string }) => part.type === "input_image")).toHaveLength(3);
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
