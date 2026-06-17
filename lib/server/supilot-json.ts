interface SupilotJsonRequest {
  apiKey: string;
  message: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseMs?: number;
}

export class SupilotJsonError extends Error {
  status?: number;
  retryAfterMs?: number;

  constructor(message: string, options?: { status?: number; retryAfterMs?: number }) {
    super(message);
    this.name = "SupilotJsonError";
    this.status = options?.status;
    this.retryAfterMs = options?.retryAfterMs;
  }
}

const DEFAULT_BASE_URL = "https://aitutor.syu.ac.kr/api";
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_MS = 1500;

export async function requestSupilotJsonObject<T>({
  apiKey,
  message,
  baseUrl = DEFAULT_BASE_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRetries = DEFAULT_MAX_RETRIES,
  retryBaseMs = DEFAULT_RETRY_BASE_MS,
}: SupilotJsonRequest): Promise<T> {
  if (!apiKey) {
    throw new SupilotJsonError("Supilot API key is not configured");
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await requestSupilotJsonObjectOnce<T>({
        apiKey,
        message,
        baseUrl,
        timeoutMs,
      });
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries || !isRetryableSupilotError(error)) {
        throw error;
      }

      await wait(getRetryDelayMs(error, attempt, retryBaseMs));
    }
  }

  throw lastError;
}

export function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;

  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function extractJsonObject(content: string): string {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new SupilotJsonError("Supilot response did not contain a JSON object");
  }

  return withoutFence.slice(start, end + 1);
}

export function compactAiText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

async function requestSupilotJsonObjectOnce<T>({
  apiKey,
  message,
  baseUrl,
  timeoutMs,
}: Required<Pick<SupilotJsonRequest, "apiKey" | "message" | "baseUrl" | "timeoutMs">>) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ message, stream: false }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new SupilotJsonError(
      `Supilot API returned ${response.status}: ${body.slice(0, 300)}`,
      {
        status: response.status,
        retryAfterMs: parseRetryAfterMs(response.headers.get("retry-after")),
      },
    );
  }

  const data = await response.json();
  const content = readSupilotContent(data);
  try {
    return JSON.parse(extractJsonObject(content)) as T;
  } catch (error) {
    if (error instanceof SupilotJsonError) {
      throw error;
    }

    throw new SupilotJsonError("Supilot response JSON was invalid");
  }
}

function readSupilotContent(data: unknown): string {
  if (!data || typeof data !== "object") return "";

  if ("content" in data && typeof data.content === "string") {
    return data.content;
  }

  const choices = "choices" in data ? data.choices : undefined;
  if (!Array.isArray(choices)) return "";

  const first = choices[0];
  if (!first || typeof first !== "object") return "";

  if (
    "message" in first &&
    first.message &&
    typeof first.message === "object" &&
    "content" in first.message &&
    typeof first.message.content === "string"
  ) {
    return first.message.content;
  }

  return "";
}

function isRetryableSupilotError(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return true;
    }
  }

  const status = error instanceof SupilotJsonError ? Number(error.status || 0) : 0;
  return status === 429 || status >= 500;
}

function getRetryDelayMs(error: unknown, attempt: number, retryBaseMs: number) {
  if (
    error instanceof SupilotJsonError &&
    Number.isFinite(error.retryAfterMs) &&
    Number(error.retryAfterMs) > 0
  ) {
    return Number(error.retryAfterMs);
  }

  return retryBaseMs * 2 ** attempt;
}

function parseRetryAfterMs(value: string | null) {
  if (!value) return 0;

  const seconds = Number.parseFloat(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const dateMs = new Date(value).getTime();
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : 0;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
