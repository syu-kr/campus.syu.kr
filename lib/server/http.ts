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
let firestoreModulePromise: Promise<typeof import("@/lib/server/firestore")> | undefined;

export class ApiError extends Error {
  status: ApiErrorStatus;
  field?: string;
  code?: string;

  constructor(
    message: string,
    status: ApiErrorStatus = 400,
    field?: string,
    code?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.field = field;
    this.code = code;
  }
}

export function apiErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, field: error.field, code: error.code },
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
  options: { limit: number; windowMs: number; persistent?: boolean },
) {
  const rateLimitKey = getRateLimitKey(req, scope);
  const localResult = checkRateLimit(rateLimitKey, options);

  if (!localResult.allowed) {
    throw new ApiError(
      `요청이 많습니다. ${localResult.retryAfterSeconds}초 후 다시 시도해주세요.`,
      429,
      undefined,
      "RATE_LIMITED",
    );
  }

  if (options.persistent === false) {
    return;
  }

  const secret =
    process.env.RATE_LIMIT_SECRET ||
    (process.env.NODE_ENV === "production"
      ? undefined
      : process.env.PUSH_API_KEY);
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Rate Limit] RATE_LIMIT_SECRET is not configured");
      throw new ApiError(
        "요청 제한 설정이 완료되지 않았습니다.",
        503,
        undefined,
        "RATE_LIMIT_CONFIG_MISSING",
      );
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
      undefined,
      "RATE_LIMITED",
    );
  }
}

/** Explicit identity keys do not acquire an IP suffix. New sensitive flows fail closed. */
export async function enforceRateLimitKey(
  key: string,
  options: { limit: number; windowMs: number; metric?: string; fixedWindow?: boolean },
) {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret) {
    throw new ApiError("요청 제한 설정이 완료되지 않았습니다.", 503, undefined, "RATE_LIMIT_CONFIG_MISSING");
  }
  const now = Date.now();
  const windowStart = options.fixedWindow === false ? 0 : Math.floor(now / options.windowMs) * options.windowMs;
  const documentId = createHmac("sha256", secret)
    .update(`${key}:${windowStart}`)
    .digest("hex");
  const result = await checkPersistentRateLimit(documentId, {
    ...options,
    resetAtMs: (options.fixedWindow === false ? now : windowStart) + options.windowMs,
    windowStart: new Date(windowStart).toISOString().slice(0, 10),
  });
  if (!result.allowed) {
    throw new ApiError(`요청이 많습니다. ${result.retryAfterSeconds}초 후 다시 시도해주세요.`, 429, undefined, "RATE_LIMITED");
  }
}

export async function readJsonBody<T = unknown>(
  req: Request,
  maxBytes = DEFAULT_MAX_JSON_BYTES,
): Promise<T> {
  enforceSameOrigin(req);

  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new ApiError(
      "Content-Type은 application/json이어야 합니다.",
      415,
      undefined,
      "UNSUPPORTED_CONTENT_TYPE",
    );
  }

  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ApiError(
      "요청 본문이 너무 큽니다.",
      413,
      undefined,
      "REQUEST_TOO_LARGE",
    );
  }

  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, "utf8") > maxBytes) {
    throw new ApiError(
      "요청 본문이 너무 큽니다.",
      413,
      undefined,
      "REQUEST_TOO_LARGE",
    );
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new ApiError(
      "JSON 요청 본문이 올바르지 않습니다.",
      400,
      undefined,
      "INVALID_JSON",
    );
  }
}

export function enforceSameOrigin(req: Request) {
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
    throw new ApiError(
      "허용되지 않은 출처의 요청입니다.",
      403,
      undefined,
      "FORBIDDEN_ORIGIN",
    );
  }
}

export function rateLimitResponse(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 429) {
    return null;
  }

  const retryAfterSeconds =
    error.message.match(/(\d+)초/)?.[1] ?? String(60);

  return NextResponse.json(
    { error: error.message, code: error.code },
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
  options: { limit: number; windowMs: number; resetAtMs?: number; metric?: string; windowStart?: string },
) {
  const { admin, getFirestore } = await (firestoreModulePromise ??= import("@/lib/server/firestore"));
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
        options.resetAtMs ?? now + options.windowMs,
      );
      transaction.set(ref, {
        count: 1,
        reset_at: nextResetAt,
        expires_at: nextResetAt,
        ...(options.metric ? { metric: options.metric, window_start: options.windowStart } : {}),
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
