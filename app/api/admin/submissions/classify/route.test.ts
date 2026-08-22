import { describe, expect, it } from "vitest";
import { OpenAiJsonError } from "@/lib/server/openai-json";
import { openAiErrorResponse } from "./route";

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
});
