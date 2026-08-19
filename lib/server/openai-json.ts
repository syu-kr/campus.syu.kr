import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

export type OpenAiJsonErrorKind =
  | "auth"
  | "permission"
  | "rate-limit"
  | "quota"
  | "timeout"
  | "server"
  | "incomplete"
  | "refusal"
  | "invalid-response";

export interface OpenAiJsonUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface OpenAiJsonResult<T> {
  value: T;
  provider: "openai";
  model: string;
  promptVersion: string;
  schemaVersion: number;
  requestId?: string;
  usage: OpenAiJsonUsage;
  latencyMs: number;
}

interface OpenAiJsonRequest<T> {
  apiKey: string;
  model: string;
  instructions: string;
  input: unknown;
  schemaName: string;
  schema: Record<string, unknown>;
  promptVersion: string;
  schemaVersion: number;
  maxOutputTokens: number;
  timeoutMs: number;
  maxRetries: number;
  client?: OpenAI;
  validate: (value: unknown) => T;
}

export class OpenAiJsonError extends Error {
  readonly kind: OpenAiJsonErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly requestId?: string;

  constructor(
    kind: OpenAiJsonErrorKind,
    message: string,
    metadata: { status?: number; code?: string; requestId?: string } = {},
  ) {
    super(message);
    this.name = "OpenAiJsonError";
    this.kind = kind;
    this.status = metadata.status;
    this.code = metadata.code;
    this.requestId = metadata.requestId;
  }
}

export async function requestOpenAiJsonObject<T>({
  apiKey,
  model,
  instructions,
  input,
  schemaName,
  schema,
  promptVersion,
  schemaVersion,
  maxOutputTokens,
  timeoutMs,
  maxRetries,
  client,
  validate,
}: OpenAiJsonRequest<T>): Promise<OpenAiJsonResult<T>> {
  if (!apiKey) {
    throw new OpenAiJsonError("auth", "OpenAI API key is not configured");
  }

  const openai = client ?? new OpenAI({ apiKey, timeout: timeoutMs, maxRetries });
  const request: ResponseCreateParamsNonStreaming = {
    model,
    instructions,
    input: typeof input === "string" ? input : JSON.stringify(input),
    store: false,
    reasoning: { effort: "none" },
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: schemaName,
        strict: true,
        schema,
      },
    },
    max_output_tokens: maxOutputTokens,
  };
  const startedAt = Date.now();

  try {
    const response = await openai.responses.create(request);
    const requestId = response._request_id || undefined;

    if (response.status !== "completed") {
      throw new OpenAiJsonError("incomplete", "OpenAI response was not completed", {
        requestId,
        code: response.incomplete_details?.reason,
      });
    }

    if (hasRefusal(response.output)) {
      throw new OpenAiJsonError("refusal", "OpenAI refused the request", {
        requestId,
      });
    }

    const outputText = response.output_text?.trim();
    if (!outputText) {
      throw new OpenAiJsonError(
        "invalid-response",
        "OpenAI response did not include output_text",
        { requestId },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      throw new OpenAiJsonError(
        "invalid-response",
        "OpenAI response was not valid JSON",
        { requestId },
      );
    }

    try {
      return {
        value: validate(parsed),
        provider: "openai",
        model: response.model || model,
        promptVersion,
        schemaVersion,
        requestId,
        usage: {
          inputTokens: Number(response.usage?.input_tokens || 0),
          outputTokens: Number(response.usage?.output_tokens || 0),
          totalTokens: Number(response.usage?.total_tokens || 0),
        },
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (error instanceof OpenAiJsonError) throw error;
      throw new OpenAiJsonError(
        "invalid-response",
        "OpenAI response failed local validation",
        { requestId },
      );
    }
  } catch (error) {
    if (error instanceof OpenAiJsonError) throw error;
    throw classifyOpenAiJsonError(error);
  }
}

export function classifyOpenAiJsonError(error: unknown): OpenAiJsonError {
  const record = toRecord(error);
  const status = readStatus(record.status);
  const code = readErrorCode(record);
  const requestId = readString(record.request_id) || readString(record.requestId);
  const name = readString(record.name);
  const message = readString(record.message).toLowerCase();

  let kind: OpenAiJsonErrorKind = "invalid-response";
  if (status === 401) kind = "auth";
  else if (status === 403) kind = "permission";
  else if (
    status === 429 &&
    (code === "insufficient_quota" ||
      code === "billing_hard_limit_reached" ||
      message.includes("quota"))
  ) {
    kind = "quota";
  } else if (status === 429) kind = "rate-limit";
  else if (
    name === "APIConnectionTimeoutError" ||
    name === "TimeoutError" ||
    name === "AbortError"
  ) {
    kind = "timeout";
  } else if (status !== undefined && status >= 500) kind = "server";

  return new OpenAiJsonError(kind, `OpenAI request failed (${kind})`, {
    status,
    code,
    requestId,
  });
}

export function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;

  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function compactAiText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function hasRefusal(output: unknown): boolean {
  if (!Array.isArray(output)) return false;
  return output.some((item) => {
    if (!item || typeof item !== "object" || !("type" in item)) return false;
    if (item.type !== "message" || !("content" in item)) return false;
    return (
      Array.isArray(item.content) &&
      (item.content as unknown[]).some(
        (part: unknown) =>
          part && typeof part === "object" && "type" in part && part.type === "refusal",
      )
    );
  });
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readStatus(value: unknown): number | undefined {
  const status = Number(value);
  return Number.isInteger(status) && status > 0 ? status : undefined;
}

function readErrorCode(record: Record<string, unknown>): string | undefined {
  const nested = toRecord(record.error);
  return (
    readString(record.code) || readString(nested.code) || readString(nested.type) || undefined
  );
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
