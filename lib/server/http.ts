import { NextResponse } from "next/server";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

export type ApiErrorStatus = 400 | 401 | 403 | 404 | 429 | 500;

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

  const message = error instanceof Error ? error.message : fallbackMessage;
  return NextResponse.json({ error: message }, { status: 400 });
}

export function apiServerErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof ApiError) {
    return apiErrorResponse(error, fallbackMessage);
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  return NextResponse.json({ error: message }, { status: 500 });
}

export function enforceRateLimit(
  req: Request,
  scope: string,
  options: { limit: number; windowMs: number },
) {
  const result = checkRateLimit(getRateLimitKey(req, scope), options);

  if (!result.allowed) {
    throw new ApiError(
      `요청이 많습니다. ${result.retryAfterSeconds}초 후 다시 시도해주세요.`,
      429,
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
  return req.headers.get("user-agent") || "unknown";
}
