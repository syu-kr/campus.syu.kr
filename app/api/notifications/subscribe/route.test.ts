import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  enforceRateLimit,
  getFirestore,
  getDocument,
  writeToken,
  deleteTokenDocument,
} = vi.hoisted(() => {
  const writeToken = vi.fn();
  const deleteTokenDocument = vi.fn();
  const getDocument = vi.fn(() => ({
    set: writeToken,
    delete: deleteTokenDocument,
  }));
  return {
    enforceRateLimit: vi.fn(),
    getFirestore: vi.fn(() => ({
      collection: () => ({ doc: getDocument }),
    })),
    getDocument,
    writeToken,
    deleteTokenDocument,
  };
});

vi.mock("@/lib/server/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/http")>()),
  enforceRateLimit,
}));
vi.mock("@/lib/server/firestore", () => ({
  getFirestore,
  nowTimestamp: () => "test-timestamp",
}));

import { ApiError } from "@/lib/server/http";
import { DELETE, POST } from "./route";

const TOKEN = "test-fcm-token-long-enough-for-subscription";
const TOKEN_HASH = createHash("sha256").update(TOKEN).digest("hex");
const IP = "192.0.2.42";
const rateLimitError = () =>
  new ApiError("요청이 많습니다. 17초 후 다시 시도해주세요.", 429, undefined, "RATE_LIMITED");

function request(method = "POST", token = TOKEN) {
  return new NextRequest("https://campus.syu.kr/api/notifications/subscribe", {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: "https://campus.syu.kr",
      "x-vercel-forwarded-for": IP,
    },
    body: JSON.stringify({ fcm_token: token }),
  });
}

describe("notification subscription rate-limit diagnostics", () => {
  beforeEach(() => {
    enforceRateLimit.mockReset().mockResolvedValue(undefined);
    getFirestore.mockClear();
    getDocument.mockClear();
    writeToken.mockReset().mockResolvedValue(undefined);
    deleteTokenDocument.mockReset().mockResolvedValue(undefined);
  });

  it.each([
    ["notification-subscribe", "subscribe-ip"],
    ["notification-token:" + TOKEN_HASH, "subscribe-token-ip"],
  ])("labels the rejecting %s limit without exposing identities", async (blockingKey, expectedScope) => {
    enforceRateLimit.mockImplementation(async (_req, key) => {
      if (key === blockingKey) throw rateLimitError();
    });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get("X-RateLimit-Scope")).toBe(expectedScope);
    expect(response.headers.get("Retry-After")).toBe("17");
    expect(body).toEqual({
      error: "요청이 많습니다. 17초 후 다시 시도해주세요.",
      code: "RATE_LIMITED",
    });
    const diagnostics = JSON.stringify({
      headers: Object.fromEntries(response.headers),
      body,
    });
    expect(diagnostics).not.toContain(TOKEN);
    expect(diagnostics).not.toContain(TOKEN_HASH);
    expect(diagnostics).not.toContain(IP);
    expect(getFirestore).not.toHaveBeenCalled();
    expect(writeToken).not.toHaveBeenCalled();
  });

  it("preserves the existing limit keys, limits, and successful token writes", async () => {
    const req = request();
    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(response.headers.get("X-RateLimit-Scope")).toBeNull();
    expect(await response.json()).toEqual({
      success: true,
      message: "FCM 토큰이 저장되었습니다",
    });
    expect(enforceRateLimit).toHaveBeenNthCalledWith(1, req, "notification-subscribe", {
      limit: 30,
      windowMs: 60 * 60 * 1000,
    });
    expect(enforceRateLimit).toHaveBeenNthCalledWith(2, req, "notification-token:" + TOKEN_HASH, {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    expect(getDocument).toHaveBeenCalledWith(TOKEN_HASH);
    expect(writeToken).toHaveBeenCalledWith(
      {
        fcm_token: TOKEN,
        created_at: "test-timestamp",
        last_updated: "test-timestamp",
        active: true,
      },
      { merge: true },
    );
    expect(deleteTokenDocument).toHaveBeenCalledOnce();
  });

  it("does not attach a rate-limit scope to token validation errors", async () => {
    const response = await POST(request("POST", "short"));

    expect(response.status).toBe(400);
    expect(response.headers.get("X-RateLimit-Scope")).toBeNull();
    expect(getFirestore).not.toHaveBeenCalled();
    expect(enforceRateLimit).toHaveBeenCalledOnce();
  });

  it("keeps the DELETE rate-limit response unchanged", async () => {
    enforceRateLimit.mockRejectedValue(rateLimitError());

    const response = await DELETE(request("DELETE"));

    expect(response.status).toBe(429);
    expect(response.headers.get("X-RateLimit-Scope")).toBeNull();
    expect(response.headers.get("Retry-After")).toBe("17");
    expect(await response.json()).toEqual({
      error: "요청이 많습니다. 17초 후 다시 시도해주세요.",
      code: "RATE_LIMITED",
    });
    expect(getFirestore).not.toHaveBeenCalled();
  });
});