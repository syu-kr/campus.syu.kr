import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

export type ApiErrorStatus =
  | 400
  | 401
  | 403
  | 404
  | 409
  | 413
  | 415
  | 429
  | 500
  | 503;

const DEFAULT_MAX_JSON_BYTES = 16 * 1024;

export class ApiError extends Error {
  status: ApiErrorStatus;
  field?: string;

  constructor(message: string, status: ApiErrorStatus = 400, field?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.field = field;
  }
}

export function apiErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, field: error.field },
      { status: error.status },
    );
  }

  console.error(`[API] ${fallbackMessage}`, error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export function apiServerErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof ApiError) {
    return apiErrorResponse(error, fallbackMessage);
  }

  console.error(`[API] ${fallbackMessage}`, error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export async function enforceRateLimit(
  req: Request,
  scope: string,
  options: { limit: number; windowMs: number },
) {
  const rateLimitKey = getRateLimitKey(req, scope);
  const localResult = checkRateLimit(rateLimitKey, options);

  if (!localResult.allowed) {
    throw new ApiError(
      `요청이 많습니다. ${localResult.retryAfterSeconds}초 후 다시 시도해주세요.`,
      429,
    );
  }

  const secret = process.env.RATE_LIMIT_SECRET || process.env.PUSH_API_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Rate Limit] RATE_LIMIT_SECRET is not configured");
      throw new ApiError("요청 제한 설정이 완료되지 않았습니다.", 503);
    }
    return;
  }

  const result = await checkPersistentRateLimit(
    createHmac("sha256", secret).update(rateLimitKey).digest("hex"),
    options,
  );

  if (!result.allowed) {
    throw new ApiError(
      `요청이 많습니다. ${result.retryAfterSeconds}초 후 다시 시도해주세요.`,
      429,
    );
  }
}

export async function readJsonBody<T = unknown>(
  req: Request,
  maxBytes = DEFAULT_MAX_JSON_BYTES,
): Promise<T> {
  enforceSameOrigin(req);

  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new ApiError("Content-Type은 application/json이어야 합니다.", 415);
  }

  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ApiError("요청 본문이 너무 큽니다.", 413);
  }

  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, "utf8") > maxBytes) {
    throw new ApiError("요청 본문이 너무 큽니다.", 413);
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new ApiError("JSON 요청 본문이 올바르지 않습니다.", 400);
  }
}

function enforceSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;

  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost || req.headers.get("host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const requestOrigin =
    host && forwardedProto
      ? `${forwardedProto.split(",")[0]}://${host.split(",")[0]}`
      : new URL(req.url).origin;

  if (origin !== requestOrigin) {
    throw new ApiError("허용되지 않은 출처의 요청입니다.", 403);
  }
}

export function rateLimitResponse(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 429) {
    return null;
  }

  const retryAfterSeconds =
    error.message.match(/(\d+)초/)?.[1] ?? String(60);

  return NextResponse.json(
    { error: error.message },
    {
      status: 429,
      headers: {
        "Retry-After": retryAfterSeconds,
      },
    },
  );
}

export function getUserAgent(req: Request): string {
  return (req.headers.get("user-agent") || "unknown").slice(0, 500);
}

async function checkPersistentRateLimit(
  documentId: string,
  options: { limit: number; windowMs: number },
) {
  const { admin, getFirestore } = await import("@/lib/server/firestore");
  const db = getFirestore();
  const ref = db.collection("api_rate_limits").doc(documentId);

  return db.runTransaction(async (transaction) => {
    const now = Date.now();
    const snapshot = await transaction.get(ref);
    const resetAt = snapshot.get("reset_at");
    const resetAtMs =
      resetAt instanceof admin.firestore.Timestamp ? resetAt.toMillis() : 0;
    const count = Number(snapshot.get("count") || 0);

    if (!snapshot.exists || resetAtMs <= now) {
      const nextResetAt = admin.firestore.Timestamp.fromMillis(
        now + options.windowMs,
      );
      transaction.set(ref, {
        count: 1,
        reset_at: nextResetAt,
        expires_at: nextResetAt,
      });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (count >= options.limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
      };
    }

    transaction.update(ref, {
      count: count + 1,
      expires_at: resetAt,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  });
}
