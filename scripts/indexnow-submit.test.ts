// @vitest-environment node
import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY_LOCATION,
  INDEXNOW_ORIGIN,
  submitIndexNow,
} from "./indexnow-submit";

const key = "a123456789abcdef";
const url = `${INDEXNOW_ORIGIN}/campus/cafeteria`;

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

function fetchReturning(...statuses: number[]) {
  const fetchImpl = vi.fn<typeof fetch>();
  statuses.forEach((status) => fetchImpl.mockResolvedValueOnce(new Response(null, { status })));
  return fetchImpl;
}

describe("submitIndexNow", () => {
  it("hosts one valid UTF-8 hexadecimal ownership token", async () => {
    const token = await readFile(new URL("../public/indexnow-key.txt", import.meta.url), "utf8");
    expect(token).toMatch(/^[a-f0-9]{32}$/);
  });

  it("submits deduplicated public canonical URLs with the root key location and timeout", async () => {
    const urls = [url, `${INDEXNOW_ORIGIN}/`, `${INDEXNOW_ORIGIN}/en`,
      `${INDEXNOW_ORIGIN}/en/academic/schedule`, `${INDEXNOW_ORIGIN}/announcements/academic/123`,
      `${INDEXNOW_ORIGIN}/en/announcements/sw/2026-123`, `${INDEXNOW_ORIGIN}/service/notices/service-update`];
    const fetchImpl = fetchReturning(200);
    const onAccepted = vi.fn();
    await expect(submitIndexNow([...urls, url], key, { fetchImpl, onAccepted }))
      .resolves.toEqual({ accepted: urls.length, pendingValidation: 0, attempts: 1 });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [endpoint, init] = fetchImpl.mock.calls[0];
    expect(endpoint).toBe(INDEXNOW_ENDPOINT);
    expect(init).toMatchObject({ method: "POST", redirect: "error", signal: expect.any(AbortSignal) });
    expect(init?.headers).toEqual({ "Content-Type": "application/json; charset=utf-8" });
    expect(JSON.parse(init?.body as string)).toEqual({
      host: "campus.syu.kr", key, keyLocation: INDEXNOW_KEY_LOCATION, urlList: urls,
    });
    expect(onAccepted).toHaveBeenCalledWith(urls, 200);
  });

  it.each([
    "http://campus.syu.kr/campus/cafeteria", "https://other.invalid/campus/cafeteria",
    "https://campus.syu.kr:443/campus/cafeteria", "https://campus.syu.kr:444/campus/cafeteria",
    "https://user:password@campus.syu.kr/campus/cafeteria", `${url}?token=private`, `${url}#fragment`,
    `${INDEXNOW_ORIGIN}/account`, `${INDEXNOW_ORIGIN}/admin`, `${INDEXNOW_ORIGIN}/api/crawl-data/status`,
    `${INDEXNOW_ORIGIN}/en/more/roommates`, `${INDEXNOW_ORIGIN}/more/meet/private-room`,
    `${INDEXNOW_ORIGIN}/announcements/departments/123`, `${INDEXNOW_ORIGIN}/en/`,
    `${INDEXNOW_ORIGIN}/private/../campus/cafeteria`, `${INDEXNOW_ORIGIN}/announcements/academic/%2e%2e`,
    `${INDEXNOW_ORIGIN}/announcements/academic/id%2Fprivate`, `${INDEXNOW_ORIGIN}/announcements/academic/%252e%252e`,
    `${INDEXNOW_ORIGIN}/announcements/academic/id%3Ftoken`, `${INDEXNOW_ORIGIN}/service/notices/a%5Cb`,
    `${INDEXNOW_ORIGIN}/service/notices/bad%ZZ`,
  ])("rejects unsafe or non-public URL before sending: %s", async (unsafeUrl) => {
    const fetchImpl = fetchReturning(200);
    await expect(submitIndexNow([url, unsafeUrl], key, { fetchImpl })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each(["", "abc1234", "g1234567", "a".repeat(129)])("rejects invalid keys: %s", async (invalidKey) => {
    const fetchImpl = fetchReturning(200);
    await expect(submitIndexNow([url], invalidKey, { fetchImpl })).rejects.toThrow("IndexNow key");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("skips empty lists without a network request", async () => {
    const fetchImpl = fetchReturning(200);
    await expect(submitIndexNow([], key, { fetchImpl }))
      .resolves.toEqual({ accepted: 0, pendingValidation: 0, attempts: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("batches at 10,000 URLs and distinguishes accepted from validation pending", async () => {
    const urls = Array.from({ length: 10_001 }, (_, id) => `${INDEXNOW_ORIGIN}/announcements/academic/${id}`);
    const fetchImpl = fetchReturning(200, 202);
    const onAccepted = vi.fn();
    await expect(submitIndexNow(urls, key, { fetchImpl, onAccepted }))
      .resolves.toEqual({ accepted: 10_000, pendingValidation: 1, attempts: 2 });
    expect(JSON.parse(fetchImpl.mock.calls[0][1]?.body as string).urlList).toHaveLength(10_000);
    expect(JSON.parse(fetchImpl.mock.calls[1][1]?.body as string).urlList).toEqual(urls.slice(10_000));
    expect(onAccepted).toHaveBeenNthCalledWith(1, urls.slice(0, 10_000), 200);
    expect(onAccepted).toHaveBeenNthCalledWith(2, urls.slice(10_000), 202);
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining("HTTP 200"));
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining("key validation pending (HTTP 202)"));
  });

  it("records each accepted batch before a later batch fails", async () => {
    const urls = Array.from({ length: 10_001 }, (_, id) => `${INDEXNOW_ORIGIN}/announcements/campus/${id}`);
    const fetchImpl = fetchReturning(200, 400);
    const onAccepted = vi.fn();
    await expect(submitIndexNow(urls, key, { fetchImpl, onAccepted })).rejects.toThrow("HTTP 400");
    expect(onAccepted).toHaveBeenCalledExactlyOnceWith(urls.slice(0, 10_000), 200);
  });

  it("does not resend an accepted batch when persistence fails", async () => {
    const fetchImpl = fetchReturning(200);
    const onAccepted = vi.fn().mockRejectedValue(new Error("state write failed"));
    await expect(submitIndexNow([url], key, { fetchImpl, onAccepted })).rejects.toThrow("state write failed");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("does not submit or retry when production readiness changed before an attempt", async () => {
    const fetchImpl = fetchReturning(200);
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    const beforeAttempt = vi.fn().mockRejectedValue(new Error("production changed"));
    await expect(submitIndexNow([url], key, { fetchImpl, sleep, beforeAttempt }))
      .rejects.toThrow("production changed");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("checks production readiness again before retrying a failed request", async () => {
    const fetchImpl = fetchReturning(503, 200);
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    const beforeAttempt = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("production changed"));
    await expect(submitIndexNow([url], key, { fetchImpl, sleep, beforeAttempt }))
      .rejects.toThrow("production changed");
    expect(beforeAttempt).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(sleep).toHaveBeenCalledExactlyOnceWith(1000);
  });

  it("retries network and server errors with bounded exponential delays", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("connection failed"))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    await expect(submitIndexNow([url], key, { fetchImpl, sleep }))
      .resolves.toEqual({ accepted: 1, pendingValidation: 0, attempts: 3 });
    expect(sleep.mock.calls).toEqual([[1000], [2000]]);
    expect(vi.mocked(console.warn).mock.calls).toEqual([
      ["[IndexNow] batch=1 status=network attempt=1 retry=1 waitMs=1000"],
      ["[IndexNow] batch=1 status=503 attempt=2 retry=2 waitMs=2000"],
    ]);
  });

  it.each(["network", "server"])("stops after three failed %s attempts", async (failure) => {
    const fetchImpl = vi.fn<typeof fetch>();
    if (failure === "network") fetchImpl.mockRejectedValue(new Error("connection failed"));
    else fetchImpl.mockResolvedValue(new Response(null, { status: 500 }));
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    await expect(submitIndexNow([url], key, { fetchImpl, sleep })).rejects.toThrow("IndexNow");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[1000], [2000]]);
  });

  it.each([400, 403, 422])("fails HTTP %s immediately", async (status) => {
    const fetchImpl = fetchReturning(status);
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    await expect(submitIndexNow([url], key, { fetchImpl, sleep })).rejects.toThrow(`HTTP ${status}`);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it.each([null, "60", "invalid", "Thu, 15 Oct 2026 00:05:00 GMT"])
  ("waits at least ten minutes for rate limiting (Retry-After %s)", async (retryAfter) => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: retryAfter ? { "Retry-After": retryAfter } : {} }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    await expect(submitIndexNow([url], key, { fetchImpl, sleep, now: () => Date.parse("2026-10-15T00:00:00Z") }))
      .resolves.toEqual({ accepted: 1, pendingValidation: 0, attempts: 2 });
    expect(sleep).toHaveBeenCalledExactlyOnceWith(600_000);
    expect(console.warn).toHaveBeenCalledExactlyOnceWith("[IndexNow] batch=1 status=429 attempt=1 retry=1 waitMs=600000");
  });

  it.each(["601", "Thu, 15 Oct 2026 00:11:00 GMT"])
  ("defers instead of retrying before a longer Retry-After (%s)", async (retryAfter) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, {
      status: 429, headers: { "Retry-After": retryAfter },
    }));
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    await expect(submitIndexNow([url], key, { fetchImpl, sleep, now: () => Date.parse("2026-10-15T00:00:00Z") }))
      .rejects.toThrow("Retry-After exceeds");
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries rate limiting only once per batch", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 429 }));
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    await expect(submitIndexNow([url], key, { fetchImpl, sleep })).rejects.toThrow("after one retry");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledExactlyOnceWith(600_000);
  });
});
