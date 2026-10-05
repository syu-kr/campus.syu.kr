// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeScriptFirestore, loadEnvLocal } from "./firebase-admin";

const files = vi.hoisted(() => ({ content: "", exists: true }));
vi.mock("fs", () => ({
  existsSync: () => files.exists,
  readFileSync: () => files.content,
}));

beforeEach(() => {
  files.exists = true;
  vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", undefined);
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", undefined);
  vi.stubEnv("UNRELATED_SCRIPT_ENV", undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("maintenance script local environment", () => {
  it("ignores commented credentials and parses quoted CRLF values without loading unrelated keys", () => {
    files.content = [
      '# FIREBASE_SERVICE_ACCOUNT={"project_id":"commented"}',
      'FIREBASE_SERVICE_ACCOUNT={"project_id":"fixture","private_key":"brace } text\\nline"}',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID="fixture-project" # comment',
      "UNRELATED_SCRIPT_ENV=untrusted",
    ].join("\r\n");
    loadEnvLocal();
    expect(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)).toEqual({
      project_id: "fixture", private_key: "brace } text\nline",
    });
    expect(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID).toBe("fixture-project");
    expect(process.env.UNRELATED_SCRIPT_ENV).toBeUndefined();
  });

  it("supports standard quoted multiline JSON and preserves the exported project ID", () => {
    files.content = `FIREBASE_SERVICE_ACCOUNT='{\n"project_id":"fixture",\n"private_key":"fixture"\n}'\nNEXT_PUBLIC_FIREBASE_PROJECT_ID=local`;
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "exported");
    loadEnvLocal();
    expect(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!).project_id).toBe("fixture");
    expect(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID).toBe("exported");
  });

  it("uses an exported service account without requiring a local file", () => {
    files.exists = false;
    vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", '{"project_id":"exported"}');
    loadEnvLocal();
    expect(process.env.FIREBASE_SERVICE_ACCOUNT).toBe('{"project_id":"exported"}');
  });

  it("rejects unsupported unquoted multiline JSON without exposing its content", () => {
    files.content = 'FIREBASE_SERVICE_ACCOUNT={\n"private_key":"fixture-private"\n}';
    expect(() => loadEnvLocal()).toThrow("따옴표로 감싼 여러 줄 JSON");
    expect(process.env.FIREBASE_SERVICE_ACCOUNT).toBeUndefined();
  });

  it("redacts exported malformed credentials before SDK initialization", async () => {
    vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", "fixture-private malformed JSON");
    await expect(initializeScriptFirestore()).rejects.toThrow(/^FIREBASE_SERVICE_ACCOUNT는 유효한 JSON이어야 합니다\.$/);
  });
});
