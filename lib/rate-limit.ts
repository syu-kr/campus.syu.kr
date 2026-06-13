interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitEntry>();

/**
 * Process-local fixed-window rate limiter.
 *
 * This is intentionally lightweight for low-risk public submission endpoints.
 * It is not shared across serverless instances or deployments, so high-risk
 * endpoints should use a persistent store such as Firestore, Redis, or KV.
 */
export function checkRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= options.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  current.count++;
  buckets.set(key, current);
  return { allowed: true, retryAfterSeconds: 0 };
}

export function getRateLimitKey(req: Request, scope: string): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const ip = realIp || forwardedFor?.split(",")[0]?.trim() || "unknown";
  return `${scope}:${ip}`;
}
