// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeStudentRestaurantImage } from "./student-restaurant-openai";

const { create, construct } = vi.hoisted(() => ({ create: vi.fn(), construct: vi.fn() }));
vi.mock("openai", () => ({ default: class {
  responses = { create };
  constructor(options: unknown) { construct(options); }
} }));
const image = { bytes: Buffer.from("fixture image"), contentType: "image/png" };
const extraction = { reliable: true, weekStart: "2026-10-12", days: [{ date: "2026-10-12", breakfast: [], lunch: ["테스트 메뉴"], dinner: null }] };
const options = { apiKey: "mock-key", now: new Date("2026-10-15T00:00:00Z") };
beforeEach(() => { vi.clearAllMocks(); create.mockResolvedValue({ status: "completed", output: [], output_text: JSON.stringify(extraction) }); });

describe("Manna House OpenAI extraction", () => {
  it("uses Responses strict Structured Outputs and only an in-memory data URL", async () => {
    const result = await analyzeStudentRestaurantImage(image, { ...options, model: "configured-model" });
    expect(result).toEqual({ updatedAt: options.now.toISOString(), weekStart: extraction.weekStart, days: extraction.days });
    expect(construct).toHaveBeenCalledWith(expect.objectContaining({ logLevel: "off", baseURL: "https://api.openai.com/v1" }));
    const request = create.mock.calls[0][0];
    expect(request).toMatchObject({ model: "configured-model", store: false, text: { format: { type: "json_schema", strict: true } } });
    expect(request.input[0].content[1]).toEqual({ type: "input_image", image_url: `data:image/png;base64,${image.bytes.toString("base64")}`, detail: "high" });
    expect(JSON.stringify(request)).not.toMatch(/source\.invalid|uploadFileName|apiUrl/);
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
