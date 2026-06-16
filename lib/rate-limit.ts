import { isIP } from "node:net";

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
  const ip = getClientIp(req.headers) || "unknown";
  return `${scope}:${ip}`;
}

function getClientIp(headers: Headers): string | null {
  return (
    readFirstValidIp(headers.get("x-vercel-forwarded-for")) ||
    readLastValidIp(headers.get("x-forwarded-for")) ||
    readFirstValidIp(headers.get("x-real-ip"))
  );
}

function readFirstValidIp(value: string | null): string | null {
  if (!value) return null;

  for (const candidate of splitIpHeader(value)) {
    const ip = normalizeIpCandidate(candidate);
    if (ip) return ip;
  }

  return null;
}

function readLastValidIp(value: string | null): string | null {
  if (!value) return null;

  const candidates = splitIpHeader(value);
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const ip = normalizeIpCandidate(candidates[index]);
    if (ip) return ip;
  }

  return null;
}

function splitIpHeader(value: string): string[] {
  return value
    .split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean);
}

function normalizeIpCandidate(value: string): string | null {
  let candidate = value.replace(/^"|"$/g, "");

  if (candidate.startsWith("[") && candidate.includes("]")) {
    candidate = candidate.slice(1, candidate.indexOf("]"));
  } else {
    candidate = candidate.replace(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/, "$1");
  }

  return isIP(candidate) ? candidate : null;
}
