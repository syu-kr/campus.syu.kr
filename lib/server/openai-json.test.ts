import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import {
  OpenAiJsonError,
  classifyOpenAiJsonError,
  requestOpenAiJsonObject,
} from "./openai-json";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["value"],
  properties: { value: { type: "string" } },
};

function createClient(response: Record<string, unknown>) {
  const create = vi.fn().mockResolvedValue(response);
  return {
    client: { responses: { create } } as unknown as OpenAI,
    create,
  };
}

function request(client: OpenAI) {
  return requestOpenAiJsonObject({
    apiKey: "test-key",
    model: "gpt-5.6-luna",
    instructions: "trusted instructions",
    input: { untrusted: "input" },
    schemaName: "test_schema",
    schema,
    promptVersion: "test-v1",
    schemaVersion: 1,
    maxOutputTokens: 200,
    timeoutMs: 12_000,
    maxRetries: 2,
    client,
    validate(value) {
      if (!value || typeof value !== "object" || !("value" in value)) {
        throw new Error("invalid");
      }
      return value as { value: string };
    },
  });
}

describe("OpenAI JSON Responses client", () => {
  it("uses stateless low-verbosity strict structured outputs", async () => {
    const { client, create } = createClient({
      _request_id: "req_test",
      status: "completed",
      incomplete_details: null,
      output: [],
      output_text: JSON.stringify({ value: "ok" }),
      model: "gpt-5.6-luna",
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
    });

    await expect(request(client)).resolves.toMatchObject({
      value: { value: "ok" },
      provider: "openai",
      promptVersion: "test-v1",
      requestId: "req_test",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });
    expect(create).toHaveBeenCalledWith({
      model: "gpt-5.6-luna",
      instructions: "trusted instructions",
      input: JSON.stringify({ untrusted: "input" }),
      store: false,
      reasoning: { effort: "none" },
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "test_schema",
          strict: true,
          schema,
        },
      },
      max_output_tokens: 200,
    });
  });

  it.each([
    ["incomplete", { status: "incomplete", output: [], output_text: "" }],
    [
      "refusal",
      {
        status: "completed",
        output_text: "{}",
        output: [
          { type: "message", content: [{ type: "refusal", refusal: "no" }] },
        ],
      },
    ],
    ["invalid-response", { status: "completed", output: [], output_text: "" }],
    ["invalid-response", { status: "completed", output: [], output_text: "{" }],
  ])("rejects %s responses", async (kind, partial) => {
    const { client } = createClient({
      _request_id: "req_test",
      incomplete_details: null,
      model: "gpt-5.6-luna",
      usage: null,
      ...partial,
    });

    await expect(request(client)).rejects.toMatchObject({ kind });
  });

  it("turns local validation failures into invalid-response", async () => {
    const { client } = createClient({
      status: "completed",
      incomplete_details: null,
      output: [],
      output_text: "{}",
      model: "gpt-5.6-luna",
      usage: null,
    });
    await expect(request(client)).rejects.toBeInstanceOf(OpenAiJsonError);
    await expect(request(client)).rejects.toMatchObject({ kind: "invalid-response" });
  });

  it.each([
    [401, "invalid_api_key", "auth"],
    [403, "permission_denied", "permission"],
    [429, "rate_limit_exceeded", "rate-limit"],
    [429, "insufficient_quota", "quota"],
    [503, "server_error", "server"],
  ])("classifies %s/%s as %s", (status, code, kind) => {
    expect(classifyOpenAiJsonError({ status, code })).toMatchObject({ kind });
  });

  it("classifies SDK timeout errors", () => {
    expect(
      classifyOpenAiJsonError({ name: "APIConnectionTimeoutError" }),
    ).toMatchObject({ kind: "timeout" });
  });
});
