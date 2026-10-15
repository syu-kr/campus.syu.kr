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
const extraction = { reliable: true, year: null, days: [{ month: 10, day: 12, weekday: 1, breakfast: [], lunch: ["테스트 메뉴"], dinner: null }] };
const ingredientMeals = { breakfast: null, lunch: ["원문 재료"], dinner: null };
const ingredientExtraction = { ...extraction, days: [{ ...extraction.days[0], ...ingredientMeals }] };
const options = { apiKey: "mock-key", now: new Date("2026-10-15T00:00:00Z") };
beforeEach(() => {
  vi.resetAllMocks();
  create.mockImplementation(async (request) => ({ status: "completed", output: [], output_text: JSON.stringify(
    request.text.format.name === "student_restaurant_menu" ? extraction : ingredientExtraction,
  ) }));
});

describe("Manna House OpenAI extraction", () => {
  it("uses Responses strict Structured Outputs and only an in-memory data URL", async () => {
    const result = await analyzeStudentRestaurantImage(image, { ...options, model: "configured-model" });
    expect(result).toEqual({ updatedAt: options.now.toISOString(), weekStart: "2026-10-12", days: [{ date: "2026-10-12", breakfast: [], lunch: ["테스트 메뉴"], dinner: null, ingredients: ingredientMeals }] });
    expect(construct).toHaveBeenCalledWith(expect.objectContaining({ logLevel: "off", baseURL: "https://api.openai.com/v1" }));
    const request = create.mock.calls[0][0];
    expect(request).toMatchObject({ model: "configured-model", store: false, text: { format: { type: "json_schema", strict: true } } });
    expect(request.reasoning).toBeUndefined();
    expect(request.input[0].content).toHaveLength(11);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].input).toEqual(request.input);
    expect(create.mock.calls[1][0].text.format.name).toBe("student_restaurant_ingredients");
    expect(request.input[0].content[1]).toEqual({ type: "input_image", image_url: `data:image/png;base64,${image.bytes.toString("base64")}`, detail: "high" });
    expect(JSON.stringify(request)).not.toMatch(/source\.invalid|uploadFileName|apiUrl/);
    const tiles = request.input[0].content.slice(2);
    const firstPixels: number[] = [];
    for (const [index, tile] of tiles.entries()) {
      expect(tile).toMatchObject({ type: "input_image", detail: "high" });
      const bytes = Buffer.from(tile.image_url.split(",")[1], "base64");
      const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
      expect(info).toMatchObject({ width: index % 3 === 1 ? 24 : 16, height: 16, channels: 3 });
      expect(data[0]).toBe(data[1]);
      expect(data[0]).toBe(data[2]);
      expect(data[0]).toBe(data[3]);
      firstPixels.push(data[0]);
    }
    const sourceGray = await sharp(image.bytes).greyscale().raw().toBuffer();
    expect(firstPixels).toEqual([0, 2, 6, 20, 22, 26, 40, 42, 46].map((index) => sourceGray[index]));
  });
  it("preserves literal spelling and raw ingredients without normalizing or deduplicating", async () => {
    const literal = { ...extraction, days: [{ ...extraction.days[0], lunch: ["원문쨩/괄호(가)"] }] };
    const ingredients = { ...ingredientExtraction, days: [{ ...ingredientExtraction.days[0], lunch: ["콩,밀/계란", "콩,밀/계란"] }] };
    create.mockResolvedValueOnce({ status: "completed", output: [], output_text: JSON.stringify(literal) })
      .mockResolvedValueOnce({ status: "completed", output: [], output_text: JSON.stringify(ingredients) });
    const result = await analyzeStudentRestaurantImage(image, options);
    expect(result.days[0].lunch).toEqual(["원문쨩/괄호(가)"]);
    expect(result.days[0].ingredients).toEqual({ ...ingredientMeals, lunch: ["콩,밀/계란", "콩,밀/계란"] });
  });
  it("keeps enlarged tiles within 4096 pixels and preserves a nonzero thin edge", async () => {
    const pixels = Buffer.alloc(4000 * 2 * 3, 255);
    for (const row of [0, 1]) {
      pixels.fill(0, row * 4000 * 3, row * 4000 * 3 + 3);
      pixels.fill(0, (row * 4000 + 3999) * 3, (row * 4000 + 4000) * 3);
    }
    const bytes = await sharp(pixels, { raw: { width: 4000, height: 2, channels: 3 } }).png().toBuffer();
    await analyzeStudentRestaurantImage({ ...image, bytes }, options);
    const tiles = create.mock.calls[0][0].input[0].content.slice(2);
    expect(tiles).toHaveLength(9);
    for (const tile of tiles) {
      const metadata = await sharp(Buffer.from(tile.image_url.split(",")[1], "base64")).metadata();
      expect(metadata.width).toBeGreaterThanOrEqual(1);
      expect(metadata.width).toBeLessThanOrEqual(4096);
      expect(metadata.height).toBeGreaterThanOrEqual(1);
      expect(metadata.height).toBeLessThanOrEqual(4096);
    }
    const first = await sharp(Buffer.from(tiles[0].image_url.split(",")[1], "base64")).raw().toBuffer();
    const last = await sharp(Buffer.from(tiles[8].image_url.split(",")[1], "base64")).raw().toBuffer({ resolveWithObject: true });
    expect(first[0]).toBe(0);
    expect(last.data[(last.info.width - 1) * last.info.channels]).toBe(0);
  });
  it("starts both independent transcriptions before either response and waits for both", async () => {
    let menuResponse!: (value: unknown) => void;
    let ingredientsResponse!: (value: unknown) => void;
    let requestsStarted = 0;
    let started!: () => void;
    const bothStarted = new Promise<void>((resolve) => { started = resolve; });
    create.mockImplementation((request) => new Promise((resolve) => {
      if (request.text.format.name === "student_restaurant_menu") menuResponse = resolve;
      else ingredientsResponse = resolve;
      requestsStarted += 1;
      if (requestsStarted === 2) started();
    }));
    const pending = analyzeStudentRestaurantImage(image, options);
    await bothStarted;
    expect(create).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(create.mock.calls[1][0].input)).not.toContain("테스트 메뉴");
    let completed = false;
    void pending.then(() => { completed = true; }, () => { completed = true; });
    menuResponse({ status: "completed", output: [], output_text: JSON.stringify(extraction) });
    await Promise.resolve();
    expect(completed).toBe(false);
    ingredientsResponse({ status: "completed", output: [], output_text: JSON.stringify(ingredientExtraction) });
    const result = await pending;
    expect(result.updatedAt).toBe(options.now.toISOString());
    expect(result.days[0].ingredients).toEqual(ingredientMeals);
  });
  it.each(["menu", "ingredients"])("stops when the %s request fails", async (column) => {
    create.mockImplementation(async (request) => {
      if (request.text.format.name === `student_restaurant_${column}`) throw new Error("private source request failure");
      return { status: "completed", output: [], output_text: JSON.stringify(extraction) };
    });
    await expect(analyzeStudentRestaurantImage(image, options)).rejects.toThrow(/^STUDENT_RESTAURANT_ANALYSIS_FAILED$/);
    expect(create).toHaveBeenCalledTimes(2);
  });
  it.each([
    { days: [{ ...extraction.days[0], day: 19 }] },
    { days: [extraction.days[0], { ...extraction.days[0], day: 19 }] },
  ])("rejects different date sets instead of merging unrelated ingredients", async ({ days }) => {
    create.mockResolvedValueOnce({ status: "completed", output: [], output_text: JSON.stringify(extraction) })
      .mockResolvedValueOnce({ status: "completed", output: [], output_text: JSON.stringify({ ...ingredientExtraction, days }) });
    await expect(analyzeStudentRestaurantImage(image, options)).rejects.toThrow(/^STUDENT_RESTAURANT_ANALYSIS_FAILED$/);
  });
  it("allows absent ingredients while preserving closed and unknown menu meals", async () => {
    create.mockResolvedValueOnce({ status: "completed", output: [], output_text: JSON.stringify(extraction) })
      .mockResolvedValueOnce({ status: "completed", output: [], output_text: JSON.stringify({ ...ingredientExtraction, days: [{ ...ingredientExtraction.days[0], breakfast: null, lunch: null, dinner: null }] }) });
    const result = await analyzeStudentRestaurantImage(image, options);
    expect(result.days[0]).toMatchObject({ breakfast: [], dinner: null, ingredients: { breakfast: null, lunch: null, dinner: null } });
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
    expect(create.mock.calls[0][0]).toMatchObject({ model: "gpt-6.1-sol", reasoning: { effort: "xhigh" }, max_output_tokens: 40000 });
    expect(construct).toHaveBeenCalledWith(expect.objectContaining({ timeout: 480_000, maxRetries: 1 }));
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
