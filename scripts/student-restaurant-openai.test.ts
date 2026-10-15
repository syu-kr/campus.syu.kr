// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeStudentRestaurantImage } from "./student-restaurant-openai";

const { create, construct } = vi.hoisted(() => ({ create: vi.fn(), construct: vi.fn() }));
vi.mock("openai", () => ({ default: class {
  responses = { create };
  constructor(options: unknown) { construct(options); }
} }));
const image = { bytes: Buffer.from("fixture image"), contentType: "image/png", lastModified: "2026-10-11T22:39:00Z" };
const extraction = { reliable: true, year: null, days: [{ month: 10, day: 12, weekday: 1, breakfast: [], lunch: ["테스트 메뉴"], dinner: null }] };
const options = { apiKey: "mock-key", now: new Date("2026-10-15T00:00:00Z") };
beforeEach(() => { vi.clearAllMocks(); create.mockResolvedValue({ status: "completed", output: [], output_text: JSON.stringify(extraction) }); });

describe("Manna House OpenAI extraction", () => {
  it("uses Responses strict Structured Outputs and only an in-memory data URL", async () => {
    const result = await analyzeStudentRestaurantImage(image, { ...options, model: "configured-model" });
    expect(result).toEqual({ updatedAt: options.now.toISOString(), weekStart: "2026-10-12", days: [{ date: "2026-10-12", breakfast: [], lunch: ["테스트 메뉴"], dinner: null }] });
    expect(construct).toHaveBeenCalledWith(expect.objectContaining({ logLevel: "off", baseURL: "https://api.openai.com/v1" }));
    const request = create.mock.calls[0][0];
    expect(request).toMatchObject({ model: "configured-model", store: false, text: { format: { type: "json_schema", strict: true } } });
    expect(request.reasoning).toBeUndefined();
    expect(request.input[0].content).toHaveLength(2);
    expect(create).toHaveBeenCalledTimes(1);
    expect(request.input[0].content[1]).toEqual({ type: "input_image", image_url: `data:image/png;base64,${image.bytes.toString("base64")}`, detail: "high" });
    expect(JSON.stringify(request)).not.toMatch(/source\.invalid|uploadFileName|apiUrl/);
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
