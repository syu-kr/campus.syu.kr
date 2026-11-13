import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "./sentry-privacy";

vi.mock("@sentry/nextjs", async () => {
  const { createRequire } = await import("node:module");
  const { dirname, join } = await import("node:path");
  const require = createRequire(import.meta.url);
  // Use the installed browser SDK even though Vitest resolves packages in Node.
  return require(join(dirname(require.resolve("@sentry/nextjs/package.json")), "build/cjs/index.client.js"));
});

const { isSupported, getToken } = vi.hoisted(() => ({
  isSupported: vi.fn(),
  getToken: vi.fn(),
}));
vi.mock("firebase/messaging", () => ({ isSupported, getToken }));

describe("push initialization through the Sentry browser event pipeline", () => {
  const events: Sentry.Event[] = [];
  let client: Sentry.BrowserClient;
  let push: typeof import("./push-notifications");
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    events.length = 0;
    localStorage.clear();
    localStorage.setItem("notification_preference", "enabled");
    localStorage.setItem("fcm_token", "private-stored-token");
    vi.stubGlobal("Notification", { permission: "granted", requestPermission: vi.fn() });
    vi.stubGlobal("navigator", {
      serviceWorker: { register: vi.fn().mockResolvedValue({}), ready: Promise.resolve({}) },
      onLine: true,
    });
    fetchMock = vi.fn().mockRejectedValue(new Error("Unexpected external request"));
    vi.stubGlobal("fetch", fetchMock);
    isSupported.mockResolvedValue(true);
    vi.doMock("@/lib/firebase", () => ({
      messaging: {}, setupForegroundNotifications: vi.fn(), messagingInitializationFailure: undefined,
    }));
    Sentry.getCurrentScope().clear();
    Sentry.getIsolationScope().clear();
    client = new Sentry.BrowserClient({
      dsn: "https://public@example.invalid/1",
      stackParser: Sentry.defaultStackParser,
      integrations: [Sentry.linkedErrorsIntegration(), Sentry.dedupeIntegration()],
      beforeSend: scrubSentryEvent,
      transport: () => ({
        send: async (envelope) => {
          for (const [header, payload] of envelope[1]) {
            if (header.type === "event") events.push(payload as Sentry.Event);
          }
          return { statusCode: 200 };
        },
        flush: async () => true,
      }),
    });
    Sentry.getCurrentScope().setClient(client);
    client.init();
    push = await import("./push-notifications");
  });

  afterEach(async () => {
    await client.close();
    Sentry.getCurrentScope().setClient(undefined);
    Sentry.getCurrentScope().clear();
    Sentry.getIsolationScope().clear();
    vi.unstubAllGlobals();
  });

  it.each(["support-check", "messaging-instance"] as const)(
    "keeps %s diagnostics and removes raw SDK secrets from the final event",
    async (phase) => {
      const secret = "private-sdk-secret";
      const sdkError = Object.assign(new Error(secret, { cause: new Error(secret) }), {
        name: "FirebaseError", code: "auth/invalid-api-key",
        customData: { token: secret, endpoint: secret, email: secret },
      });
      if (phase === "support-check") isSupported.mockRejectedValue(sdkError);
      else vi.doMock("@/lib/firebase", () => ({
        messaging: null, messagingInitializationFailure: { error: sdkError },
        setupForegroundNotifications: vi.fn(),
      }));
      Sentry.setUser({ id: secret, email: secret });

      await expect(push.enablePushNotifications()).rejects.toThrow();
      await client.flush();

      expect(events).toHaveLength(1);
      const event = events[0];
      expect(event.sdk?.integrations).toEqual(expect.arrayContaining(["LinkedErrors", "Dedupe"]));
      expect(event.tags).toMatchObject({
        firebase_phase: phase, firebase_failure: "sdk-error", firebase_error_code: "auth/invalid-api-key",
      });
      expect(event.contexts?.push_initialization).toMatchObject({
        original_error_type: "FirebaseError",
        elapsed_ms: expect.objectContaining({ [phase]: expect.any(Number) }),
      });
      expect(event.exception?.values).toHaveLength(1);
      expect(event.user).toBeUndefined();
      expect(JSON.stringify(event)).not.toMatch(/private-sdk-secret|private-stored-token/);
      expect(getToken).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(Notification.requestPermission).not.toHaveBeenCalled();
    },
  );

  it.each(["code", "type"] as const)("keeps distinct SDK %ss while deduplicating an identical retry", async (identity) => {
    // Prime the lazy import so the following retries have the same async stack.
    isSupported.mockRejectedValueOnce(new SyntaxError("warmup"));
    await expect(push.enablePushNotifications()).rejects.toThrow("warmup");
    await client.flush();
    events.length = 0;
    const failures = identity === "code" ? [
      Object.assign(new Error("storage failed"), { name: "FirebaseError", code: "messaging/indexed-db-unsupported" }),
      Object.assign(new Error("unsupported"), { name: "FirebaseError", code: "messaging/unsupported-browser" }),
      Object.assign(new Error("unsupported again"), { name: "FirebaseError", code: "messaging/unsupported-browser" }),
    ] : [new Error("first failure"), new TypeError("second failure"), new TypeError("same kind again")];
    for (const failure of failures) {
      isSupported.mockRejectedValueOnce(failure);
      await expect(push.enablePushNotifications()).rejects.toBe(failure);
      await client.flush();
    }

    expect(events).toHaveLength(2);
    expect(events[0].exception?.values?.[0].stacktrace?.frames)
      .toEqual(events[1].exception?.values?.[0].stacktrace?.frames);
    expect(events.map((event) => event.fingerprint?.at(-1)))
      .toEqual(identity === "code"
        ? ["messaging/indexed-db-unsupported", "messaging/unsupported-browser"]
        : ["Error", "TypeError"]);
    expect(getToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
