import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkRateLimit,
  clearRateLimitBuckets,
  getRateLimitBucketCount,
  pruneRateLimitBuckets,
} from "./rate-limit";

describe("process-local rate limit bucket lifecycle", () => {
  beforeEach(() => {
    clearRateLimitBuckets();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T00:00:00.000Z"));
  });

  afterEach(() => {
    clearRateLimitBuckets();
    vi.useRealTimers();
  });

  it("removes expired unique keys", () => {
    checkRateLimit("contact:one", { limit: 1, windowMs: 1000 });
    checkRateLimit("contact:two", { limit: 1, windowMs: 1000 });
    expect(getRateLimitBucketCount()).toBe(2);

    vi.advanceTimersByTime(1001);
    pruneRateLimitBuckets();

    expect(getRateLimitBucketCount()).toBe(0);
  });

  it("keeps fixed-window retry behavior while refreshing LRU order", () => {
    expect(
      checkRateLimit("contact:one", { limit: 2, windowMs: 5000 }).allowed,
    ).toBe(true);
    expect(
      checkRateLimit("contact:one", { limit: 2, windowMs: 5000 }).allowed,
    ).toBe(true);

    expect(
      checkRateLimit("contact:one", { limit: 2, windowMs: 5000 }),
    ).toEqual({ allowed: false, retryAfterSeconds: 5 });
  });
});
