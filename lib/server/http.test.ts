import { describe, expect, it } from "vitest";
import { ApiError, apiErrorResponse, rateLimitResponse } from "@/lib/server/http";

describe("API error responses", () => {
  it("includes a stable error code without removing the human-readable message", async () => {
    const response = apiErrorResponse(
      new ApiError(
        "일정 방을 찾을 수 없습니다",
        404,
        undefined,
        "ROOM_NOT_FOUND",
      ),
      "fallback",
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "일정 방을 찾을 수 없습니다",
      code: "ROOM_NOT_FOUND",
    });
  });

  it("preserves the rate-limit code and retry header", async () => {
    const response = rateLimitResponse(
      new ApiError(
        "요청이 많습니다. 17초 후 다시 시도해주세요.",
        429,
        undefined,
        "RATE_LIMITED",
      ),
    );

    expect(response).not.toBeNull();
    expect(response?.headers.get("Retry-After")).toBe("17");
    expect(await response?.json()).toEqual({
      error: "요청이 많습니다. 17초 후 다시 시도해주세요.",
      code: "RATE_LIMITED",
    });
  });
});
