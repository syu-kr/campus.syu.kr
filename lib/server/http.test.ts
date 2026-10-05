import { describe, expect, it } from "vitest";
import { ApiError, apiErrorResponse, rateLimitResponse, readJsonBody } from "@/lib/server/http";

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

describe("bounded JSON request bodies", () => {
  function request(body: ReadableStream<Uint8Array>, headers?: Record<string, string>) {
    return new Request("https://campus.syu.kr/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body,
      duplex: "half",
    } as RequestInit);
  }

  it("cancels at the first oversized chunk without consuming the remaining body", async () => {
    let pulled = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(1024));
        if (pulled === 10) controller.close();
      },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 });

    await expect(readJsonBody(request(body), 512)).rejects.toMatchObject({
      status: 413, code: "REQUEST_TOO_LARGE",
    });
    expect(pulled).toBe(1);
    expect(cancelled).toBe(true);
    expect(body.locked).toBe(false);
  });

  it("counts bytes and decodes UTF-8 split across chunks at the exact limit", async () => {
    const bytes = new TextEncoder().encode('\uFEFF{"name":"삼육"}');
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 14));
        controller.enqueue(bytes.slice(14));
        controller.close();
      },
    });
    await expect(readJsonBody(request(body), bytes.byteLength)).resolves.toEqual({ name: "삼육" });
  });

  it("keeps origin, content type, declared size, and invalid JSON errors", async () => {
    const makeRequest = (headers: Record<string, string>, body = "{") => new Request(
      "https://campus.syu.kr/api/contact", {
        method: "POST", headers: { "content-type": "application/json", ...headers }, body,
      },
    );
    await expect(readJsonBody(makeRequest({ origin: "https://other.test" }))).rejects.toMatchObject({ status: 403 });
    await expect(readJsonBody(makeRequest({ "content-type": "text/plain" }))).rejects.toMatchObject({ status: 415 });
    await expect(readJsonBody(makeRequest({ "content-length": "100" }), 10)).rejects.toMatchObject({ status: 413 });
    await expect(readJsonBody(makeRequest({}))).rejects.toMatchObject({ status: 400, code: "INVALID_JSON" });
  });
});
