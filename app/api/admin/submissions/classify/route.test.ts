import { describe, expect, it } from "vitest";
import { OpenAiJsonError } from "@/lib/server/openai-json";
import {
  getAdminClassifierConfigurationError,
  openAiErrorResponse,
} from "./route";

describe("admin classifier OpenAI error mapping", () => {
  it.each([
    ["auth", 503],
    ["permission", 503],
    ["quota", 503],
    ["rate-limit", 429],
    ["timeout", 503],
    ["server", 503],
    ["refusal", 502],
    ["incomplete", 502],
    ["invalid-response", 502],
  ] as const)("maps %s to HTTP %s", async (kind, status) => {
    const response = openAiErrorResponse(
      new OpenAiJsonError(kind, "internal raw error", {
        requestId: "req_private",
      }),
    );

    expect(response.status).toBe(status);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = await response.text();
    expect(body).not.toContain("internal raw error");
    expect(body).not.toContain("req_private");
  });

  it("reports a disabled classifier separately from a missing key", () => {
    expect(
      getAdminClassifierConfigurationError(false, "sk-test"),
    ).toBe("운영자 문의 분류 AI 기능이 비활성화되어 있습니다");
    expect(
      getAdminClassifierConfigurationError(true, ""),
    ).toBe("운영자 문의 분류 AI 키가 설정되지 않았습니다");
    expect(
      getAdminClassifierConfigurationError(true, "sk-test"),
    ).toBeUndefined();
  });
});
