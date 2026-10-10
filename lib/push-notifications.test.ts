import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  captureException,
  deleteToken,
  getToken,
  isSupported,
  setupForegroundNotifications,
} = vi.hoisted(() => ({
  captureException: vi.fn(),
  deleteToken: vi.fn(),
  getToken: vi.fn(),
  isSupported: vi.fn(),
  setupForegroundNotifications: vi.fn(),
}));

vi.mock("firebase/messaging", () => ({ deleteToken, getToken, isSupported }));
vi.mock("@/lib/firebase", () => ({
  messaging: {},
  setupForegroundNotifications,
}));
vi.mock("@sentry/nextjs", () => ({ captureException }));

const TOKEN_A = "token-a-long-enough-for-testing";
const TOKEN_B = "token-b-long-enough-for-testing";
const SYNCED_KEY = "fcm_token_synced";
const RETRY_KEY = "fcm_token_retry";
const NOW = Date.UTC(2026, 9, 4, 12);
const SYNC_INTERVAL = 24 * 60 * 60 * 1000;

let push: typeof import("./push-notifications");
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

function response(status = 200, headers: Record<string, string> = {}) {
  return new Response(
    JSON.stringify(
      status === 200
        ? { success: true }
        : { error: "request rejected", code: status === 429 ? "RATE_LIMITED" : "SUBSCRIBE_FAILED" },
    ),
    { status, headers: { "Content-Type": "application/json", ...headers } },
  );
}

function writeSynced(token = TOKEN_A, savedAt = NOW) {
  localStorage.setItem(SYNCED_KEY, JSON.stringify({ token, savedAt }));
}

function readSynced() {
  return JSON.parse(localStorage.getItem(SYNCED_KEY) || "null");
}

describe("push notifications", () => {
  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    localStorage.setItem("fcm_token", TOKEN_A);
    localStorage.setItem("notification_preference", "enabled");
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    deleteToken.mockReset();
    deleteToken.mockResolvedValue(true);
    getToken.mockReset();
    getToken.mockResolvedValue(TOKEN_A);
    isSupported.mockReset();
    isSupported.mockResolvedValue(true);
    setupForegroundNotifications.mockReset();
    captureException.mockReset();
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_VAPID_KEY", "test-vapid-key");
    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission: vi.fn(),
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({}),
        register: vi.fn().mockResolvedValue({ scope: "/" }),
      },
    });
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: undefined,
    });
    fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetchMock);
    push = await import("./push-notifications");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("synchronizes existing tokens once when no success record exists", async () => {
    await expect(push.enablePushNotifications()).resolves.toBe(TOKEN_A);

    expect(fetchMock).toHaveBeenCalledWith("/api/notifications/subscribe", expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fcm_token: TOKEN_A }),
    }));
    expect(readSynced()).toEqual({ token: TOKEN_A, savedAt: NOW });
    expect(localStorage.getItem(push.FCM_TOKEN_KEY)).toBe(TOKEN_A);
    expect(push.getNotificationPreference()).toBe("enabled");
  });

  it("keeps Firebase initialization after reload without repeating a recent POST", async () => {
    await push.enablePushNotifications();
    const firstSuccess = localStorage.getItem(SYNCED_KEY);
    vi.mocked(Date.now).mockReturnValue(NOW + 60 * 60 * 1000);
    vi.resetModules();
    push = await import("./push-notifications");

    await expect(
      push.enablePushNotifications({ trigger: "automatic" }),
    ).resolves.toBe(TOKEN_A);

    expect(getToken).toHaveBeenCalledTimes(2);
    expect(setupForegroundNotifications).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(localStorage.getItem(SYNCED_KEY)).toBe(firstSuccess);
  });

  it("saves a rotated token despite the old token's recent success", async () => {
    writeSynced();
    getToken.mockResolvedValue(TOKEN_B);

    await expect(push.enablePushNotifications()).resolves.toBe(TOKEN_B);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      fcm_token: TOKEN_B,
    });
    expect(readSynced()).toEqual({ token: TOKEN_B, savedAt: NOW });
    expect(localStorage.getItem(push.FCM_TOKEN_KEY)).toBe(TOKEN_B);
  });

  it("refreshes last_updated when the 24-hour success interval has elapsed", async () => {
    writeSynced(TOKEN_A, NOW - SYNC_INTERVAL);

    await push.enablePushNotifications({ trigger: "automatic" });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(readSynced()).toEqual({ token: TOKEN_A, savedAt: NOW });
  });

  it.each([
    ["malformed", "{invalid-json"],
    ["future", JSON.stringify({ token: TOKEN_A, savedAt: NOW + 1 })],
    ["missing token", JSON.stringify({ savedAt: NOW })],
    ["invalid time", JSON.stringify({ token: TOKEN_A, savedAt: "today" })],
  ])("replaces a %s success record by actually saving", async (_name, stored) => {
    localStorage.setItem(SYNCED_KEY, stored);

    await push.enablePushNotifications();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(readSynced()).toEqual({ token: TOKEN_A, savedAt: NOW });
  });

  it("preserves the last successful token and timestamp after a rejected rotated token", async () => {
    writeSynced();
    getToken.mockResolvedValue(TOKEN_B);
    fetchMock.mockResolvedValue(response(500));

    await expect(push.enablePushNotifications()).rejects.toMatchObject({
      status: 500,
      code: "SUBSCRIBE_FAILED",
    });

    expect(localStorage.getItem(push.FCM_TOKEN_KEY)).toBe(TOKEN_A);
    expect(readSynced()).toEqual({ token: TOKEN_A, savedAt: NOW });
  });

  it("persists a 429 wait across reload and retries only after expiry", async () => {
    const previousSuccess = { token: TOKEN_A, savedAt: NOW - SYNC_INTERVAL };
    localStorage.setItem(SYNCED_KEY, JSON.stringify(previousSuccess));
    fetchMock.mockResolvedValueOnce(
      response(429, {
        "Retry-After": "120",
        "X-RateLimit-Scope": "subscribe-token-ip",
      }),
    );

    await expect(
      push.enablePushNotifications({ trigger: "automatic" }),
    ).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
      scope: "subscribe-token-ip",
      retryAt: NOW + 120_000,
      fromCooldown: false,
    });
    expect(readSynced()).toEqual(previousSuccess);
    expect(JSON.parse(localStorage.getItem(RETRY_KEY) || "null")).toEqual({
      token: TOKEN_A,
      scope: "subscribe-token-ip",
      retryAt: NOW + 120_000,
    });
    expect(captureException).toHaveBeenCalledOnce();

    vi.resetModules();
    push = await import("./push-notifications");
    await expect(
      push.enablePushNotifications({ trigger: "automatic" }),
    ).rejects.toMatchObject({ status: 429, fromCooldown: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(captureException).toHaveBeenCalledOnce();
    expect(readSynced()).toEqual(previousSuccess);

    vi.mocked(Date.now).mockReturnValue(NOW + 120_000);
    await expect(
      push.enablePushNotifications({ trigger: "automatic" }),
    ).resolves.toBe(TOKEN_A);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(readSynced()).toEqual({
      token: TOKEN_A,
      savedAt: NOW + 120_000,
    });
    expect(localStorage.getItem(RETRY_KEY)).toBeNull();
  });

  it("does not let token A's wait prevent saving token B", async () => {
    localStorage.setItem(
      RETRY_KEY,
      JSON.stringify({
        token: TOKEN_A,
        scope: "subscribe-token-ip",
        retryAt: NOW + 120_000,
      }),
    );
    getToken.mockResolvedValue(TOKEN_B);

    await expect(push.enablePushNotifications()).resolves.toBe(TOKEN_B);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(readSynced()).toEqual({ token: TOKEN_B, savedAt: NOW });
  });

  it("applies an IP-wide wait even after token rotation", async () => {
    localStorage.setItem(
      RETRY_KEY,
      JSON.stringify({
        token: TOKEN_A,
        scope: "subscribe-ip",
        retryAt: NOW + 120_000,
      }),
    );
    getToken.mockResolvedValue(TOKEN_B);

    await expect(push.enablePushNotifications()).rejects.toMatchObject({
      status: 429,
      scope: "subscribe-ip",
      fromCooldown: true,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
    expect(localStorage.getItem(push.FCM_TOKEN_KEY)).toBe(TOKEN_A);
  });

  it("treats an unknown 429 scope as a wait for the attempted token", async () => {
    fetchMock.mockResolvedValue(
      response(429, {
        "Retry-After": "60",
        "X-RateLimit-Scope": "unrecognized",
      }),
    );

    await expect(push.enablePushNotifications()).rejects.toMatchObject({
      scope: "subscribe-token-ip",
      retryAt: NOW + 60_000,
    });
    expect(JSON.parse(localStorage.getItem(RETRY_KEY) || "null")).toEqual({
      token: TOKEN_A,
      scope: "subscribe-token-ip",
      retryAt: NOW + 60_000,
    });
  });

  it.each([
    ["missing", undefined, 60_000],
    ["malformed", "not-a-date", 60_000],
    ["HTTP date", new Date(NOW + 90_000).toUTCString(), 90_000],
    ["too long", "7200", 60 * 60 * 1000],
  ])("uses a bounded wait for a %s Retry-After header", async (_name, retryAfter, delay) => {
    fetchMock.mockResolvedValue(
      response(429, retryAfter ? { "Retry-After": retryAfter } : {}),
    );

    await expect(push.enablePushNotifications()).rejects.toMatchObject({
      status: 429,
      retryAt: NOW + delay,
    });
  });

  it("serializes callers with different triggers without repeating a successful POST", async () => {
    await Promise.all([
      push.enablePushNotifications({ trigger: "automatic" }),
      push.enablePushNotifications({ trigger: "manual" }),
    ]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(getToken).toHaveBeenCalledTimes(2);
  });

  it("reports API errors with HTTP metadata without exposing the token", async () => {
    fetchMock.mockResolvedValue(
      response(429, {
        "Retry-After": "60",
        "X-RateLimit-Scope": "subscribe-token-ip",
      }),
    );

    await expect(
      push.enablePushNotifications({ trigger: "automatic" }),
    ).rejects.toBeInstanceOf(push.PushSubscriptionError);

    expect(captureException).toHaveBeenCalledWith(
      expect.any(push.PushSubscriptionError),
      expect.objectContaining({
        tags: expect.objectContaining({
          trigger: "automatic",
          step: "saving-fcm-token",
          http_status: "429",
          rate_limit_scope: "subscribe-token-ip",
          error_code: "RATE_LIMITED",
        }),
      }),
    );
    expect(JSON.stringify(captureException.mock.calls)).not.toContain(TOKEN_A);
    expect(captureException.mock.calls[0][1].tags).not.toHaveProperty(
      "firebase_error_code",
    );
  });

  describe("automatic subscription network recovery", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    });

    async function startNetworkFailure() {
      let rejectPost!: (error: Error) => void;
      fetchMock.mockImplementationOnce(() => new Promise<Response>((_, reject) => { rejectPost = reject; }));
      const enabling = push.enablePushNotifications({ trigger: "automatic" });
      void enabling.catch(() => {});
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
      rejectPost(new TypeError("Load failed"));
      await vi.advanceTimersByTimeAsync(0);
      return { enabling };
    }

    it("retries once after five seconds without renewing the token or recording success early", async () => {
      writeSynced();
      getToken.mockResolvedValue(TOKEN_B);
      const { enabling } = await startNetworkFailure();

      expect(localStorage.getItem(push.FCM_TOKEN_KEY)).toBe(TOKEN_A);
      expect(localStorage.getItem("fcm_token_pending")).toBe(TOKEN_B);
      expect(readSynced()).toEqual({ token: TOKEN_A, savedAt: NOW });
      await vi.advanceTimersByTimeAsync(4999);
      expect(fetchMock).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(1);

      await expect(enabling).resolves.toBe(TOKEN_B);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(getToken).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls.map((call) => JSON.parse(call[1]?.body as string).fcm_token))
        .toEqual([TOKEN_B, TOKEN_B]);
      expect(readSynced()).toEqual({ token: TOKEN_B, savedAt: Date.now() });
      expect(readSynced().savedAt).toBeGreaterThan(NOW);
      expect(localStorage.getItem("fcm_token_pending")).toBeNull();
      expect(captureException).not.toHaveBeenCalled();
    });

    it("stops after the second failure, reports once, and leaves the uncertain token available to opt out", async () => {
      getToken.mockResolvedValue(TOKEN_B);
      fetchMock.mockRejectedValue(new TypeError("still offline"));
      const { enabling } = await startNetworkFailure();
      const rejection = expect(enabling).rejects.toThrow("still offline");
      await vi.advanceTimersByTimeAsync(20_000);
      await rejection;

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(captureException).toHaveBeenCalledOnce();
      expect(localStorage.getItem(push.FCM_TOKEN_KEY)).toBe(TOKEN_A);
      expect(localStorage.getItem("fcm_token_pending")).toBe(TOKEN_B);
      expect(readSynced()).toBeNull();
      fetchMock.mockResolvedValue(response());
      await push.disablePushNotifications();
      expect(fetchMock.mock.calls.slice(2).map((call) => JSON.parse(call[1]?.body as string).fcm_token).sort())
        .toEqual([TOKEN_A, TOKEN_B].sort());
      expect(localStorage.getItem("fcm_token_pending")).toBeNull();
    });

    it.each([400, 403, 429, 500])("does not retry an HTTP %s response", async (status) => {
      fetchMock.mockResolvedValue(response(status));
      await expect(push.enablePushNotifications({ trigger: "automatic" })).rejects.toMatchObject({ status });
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(captureException).toHaveBeenCalledOnce();
      if (status < 500) expect(localStorage.getItem("fcm_token_pending")).toBeNull();
    });

    it("keeps the 429 cooldown when the retry receives a rate-limit response", async () => {
      fetchMock.mockResolvedValue(response(429, { "Retry-After": "120", "X-RateLimit-Scope": "subscribe-ip" }));
      const { enabling } = await startNetworkFailure();
      const rejection = expect(enabling).rejects.toMatchObject({ status: 429, fromCooldown: false });
      await vi.advanceTimersByTimeAsync(5000);
      await rejection;

      await expect(push.enablePushNotifications({ trigger: "automatic" })).rejects.toMatchObject({
        status: 429, fromCooldown: true, scope: "subscribe-ip",
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(captureException).toHaveBeenCalledOnce();
    });

    it.each([400, 429])("preserves the first uncertain write when its retry receives HTTP %s", async (status) => {
      writeSynced();
      getToken.mockResolvedValue(TOKEN_B);
      fetchMock.mockResolvedValue(response(status, { "Retry-After": "120", "X-RateLimit-Scope": "subscribe-ip" }));
      const { enabling } = await startNetworkFailure();
      const rejection = expect(enabling).rejects.toMatchObject({ status });
      await vi.advanceTimersByTimeAsync(5000);
      await rejection;

      expect(localStorage.getItem(push.FCM_TOKEN_KEY)).toBe(TOKEN_A);
      expect(localStorage.getItem("fcm_token_pending")).toBe(TOKEN_B);
      expect(readSynced()).toEqual({ token: TOKEN_A, savedAt: NOW });
      expect(captureException).toHaveBeenCalledOnce();
      if (status === 429) {
        await expect(push.enablePushNotifications({ trigger: "automatic" })).rejects.toMatchObject({
          status: 429, fromCooldown: true, scope: "subscribe-ip",
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(captureException).toHaveBeenCalledOnce();
        expect(localStorage.getItem("fcm_token_pending")).toBe(TOKEN_B);
      }

      fetchMock.mockResolvedValue(response());
      await push.disablePushNotifications();
      const deletes = fetchMock.mock.calls.slice(2);
      expect(deletes.every((call) => call[1]?.method === "DELETE")).toBe(true);
      expect(deletes.map((call) => JSON.parse(call[1]?.body as string).fcm_token).sort())
        .toEqual([TOKEN_A, TOKEN_B].sort());
      expect(localStorage.getItem("fcm_token_pending")).toBeNull();
    });

    it.each(["subscribe-ip", "subscribe-token-ip"])("rechecks a newly recorded %s cooldown before retrying", async (scope) => {
      const { enabling } = await startNetworkFailure();
      localStorage.setItem(RETRY_KEY, JSON.stringify({ token: TOKEN_A, scope, retryAt: NOW + 120_000 }));
      const rejection = expect(enabling).rejects.toMatchObject({ status: 429, fromCooldown: true, scope });
      await vi.advanceTimersByTimeAsync(5000);
      await rejection;
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(captureException).not.toHaveBeenCalled();
      expect(localStorage.getItem("fcm_token_pending")).toBe(TOKEN_A);
    });

    it.each(["offline", "hidden"])("does not schedule a retry while already %s", async (state) => {
      if (state === "offline") vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
      else vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
      fetchMock.mockRejectedValue(new TypeError("Load failed"));
      await expect(push.enablePushNotifications({ trigger: "automatic" })).rejects.toThrow("Load failed");
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it.each(["offline", "hidden", "preference", "revision"])("rechecks %s after the delay", async (state) => {
      const { enabling } = await startNetworkFailure();
      if (state === "offline") vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
      else if (state === "hidden") vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
      else if (state === "preference") localStorage.setItem("notification_preference", "disabled");
      else localStorage.setItem("notification_disabled_revision", "another-tab-disabled");
      const result = state === "offline" || state === "hidden"
        ? expect(enabling).rejects.toThrow("Load failed")
        : expect(enabling).resolves.toBeNull();
      await vi.advanceTimersByTimeAsync(5000);
      await result;
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(localStorage.getItem("fcm_token_pending")).toBe(TOKEN_A);
    });

    it("cleans up the uncertain write when permission is revoked during the retry delay", async () => {
      getToken.mockResolvedValue(TOKEN_B);
      const { enabling } = await startNetworkFailure();
      vi.stubGlobal("Notification", { permission: "denied" });
      await vi.advanceTimersByTimeAsync(5000);
      await expect(enabling).resolves.toBeNull();

      expect(fetchMock.mock.calls.map((call) => call[1]?.method)).toEqual(["POST", "DELETE", "DELETE"]);
      expect(fetchMock.mock.calls.slice(1).map((call) => JSON.parse(call[1]?.body as string).fcm_token).sort())
        .toEqual([TOKEN_A, TOKEN_B].sort());
      expect(deleteToken).toHaveBeenCalledOnce();
      expect(push.getNotificationPreference()).toBe("disabled");
      expect(localStorage.getItem("fcm_token_pending")).toBeNull();
      expect(localStorage.getItem(push.FCM_TOKEN_KEY)).toBeNull();
      expect(readSynced()).toBeNull();
      expect(captureException).not.toHaveBeenCalled();
    });

    it("preserves shared calls, the operation queue, and native locking during recovery", async () => {
      const request = vi.fn(async (...args: unknown[]) => (args.at(-1) as () => Promise<unknown>)());
      Object.defineProperty(navigator, "locks", { configurable: true, value: { request } });
      const { enabling } = await startNetworkFailure();
      const shared = push.enablePushNotifications({ trigger: "automatic" });
      const manual = push.enablePushNotifications({ trigger: "manual" });
      expect(request).toHaveBeenCalledOnce();
      expect(getToken).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(5000);
      await expect(Promise.all([enabling, shared, manual])).resolves.toEqual([TOKEN_A, TOKEN_A, TOKEN_A]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(getToken).toHaveBeenCalledTimes(2);
      expect(request).toHaveBeenCalledTimes(2);
      expect(request.mock.calls.every((call) => call[0] === "syu-push-notifications")).toBe(true);
    });

    it("lets queued opt-out delete both tokens without sending the scheduled retry", async () => {
      getToken.mockResolvedValue(TOKEN_B);
      const { enabling } = await startNetworkFailure();
      const disabling = push.disablePushNotifications();
      expect(push.getNotificationPreference()).toBe("disabled");
      await vi.advanceTimersByTimeAsync(5000);
      await expect(enabling).resolves.toBeNull();
      await disabling;
      expect(fetchMock.mock.calls.map((call) => call[1]?.method)).toEqual(["POST", "DELETE", "DELETE"]);
      expect(localStorage.getItem("fcm_token_pending")).toBeNull();
      expect(localStorage.getItem(push.FCM_TOKEN_KEY)).toBeNull();
      expect(captureException).not.toHaveBeenCalled();
    });

    it("does not retry manual calls, DELETE, or Firebase failures", async () => {
      fetchMock.mockRejectedValue(new TypeError("Load failed"));
      await expect(push.enablePushNotifications()).rejects.toThrow("Load failed");
      expect(fetchMock).toHaveBeenCalledOnce();
      await expect(push.disablePushNotifications()).rejects.toThrow();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      fetchMock.mockClear();
      localStorage.setItem("notification_preference", "enabled");
      getToken.mockRejectedValue(new TypeError("Firebase failure"));
      await expect(push.enablePushNotifications({ trigger: "automatic" })).rejects.toThrow("Firebase failure");
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does not retry an aborted or timed-out POST", async () => {
      fetchMock.mockRejectedValueOnce(new DOMException("aborted", "AbortError"));
      await expect(push.enablePushNotifications({ trigger: "automatic" })).rejects.toThrow("aborted");
      fetchMock.mockImplementationOnce(() => new Promise<Response>(() => {}));
      const enabling = push.enablePushNotifications({ trigger: "automatic" });
      const rejection = expect(enabling).rejects.toThrow("알림 서버 응답 시간이 초과되었습니다.");
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      const signal = fetchMock.mock.calls[1][1]?.signal as AbortSignal;
      await vi.advanceTimersByTimeAsync(15_000);
      await rejection;
      expect(signal.aborted).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it("shares one same-tab enable operation and reports completion to both callers", async () => {
    const firstStatus = vi.fn();
    const secondStatus = vi.fn();

    await Promise.all([
      push.enablePushNotifications({
        trigger: "automatic",
        onStatus: firstStatus,
      }),
      push.enablePushNotifications({
        trigger: "automatic",
        onStatus: secondStatus,
      }),
    ]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(getToken).toHaveBeenCalledOnce();
    expect(firstStatus).toHaveBeenLastCalledWith("enabled");
    expect(secondStatus).toHaveBeenLastCalledWith("enabled");
  });

  it("starts a manual permission request synchronously before waiting for a native lock", async () => {
    const notification = {
      permission: "default",
      requestPermission: vi.fn(),
    };
    const requestPermission = notification.requestPermission;
    requestPermission.mockImplementation(async () => {
      notification.permission = "granted";
      return "granted";
    });
    vi.stubGlobal("Notification", notification);
    let releaseLock!: () => void;
    const request = vi.fn(
      (...args: unknown[]) => new Promise<unknown>((resolve, reject) => {
        releaseLock = () => {
          const callback = args.at(-1) as () => Promise<unknown>;
          void Promise.resolve().then(callback).then(resolve, reject);
        };
      }),
    );
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request },
    });

    const enabling = push.enablePushNotifications({ trigger: "manual" });

    expect(requestPermission).toHaveBeenCalledOnce();
    expect(getToken).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(releaseLock).toBeTypeOf("function"));
    expect(fetchMock).not.toHaveBeenCalled();
    releaseLock();

    await expect(enabling).resolves.toBe(TOKEN_A);
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not ask for permission during automatic initialization", async () => {
    const requestPermission = vi.fn();
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission,
    });

    await expect(
      push.enablePushNotifications({ trigger: "automatic" }),
    ).resolves.toBeNull();

    expect(requestPermission).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the same native lock for enable and disable", async () => {
    const request = vi.fn(async (...args: unknown[]) => {
      const callback = args.at(-1) as () => Promise<unknown>;
      return callback();
    });
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request },
    });

    await push.enablePushNotifications();
    await push.disablePushNotifications();

    expect(request).toHaveBeenCalledTimes(2);
    expect(typeof request.mock.calls[0][0]).toBe("string");
    expect(request.mock.calls[0][0]).toBe(request.mock.calls[1][0]);
  });

  it("checks shared success state again after acquiring the native lock", async () => {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: vi.fn(async (...args: unknown[]) => {
          writeSynced();
          const callback = args.at(-1) as () => Promise<unknown>;
          return callback();
        }),
      },
    });

    await push.enablePushNotifications({ trigger: "automatic" });

    expect(getToken).toHaveBeenCalledOnce();
    expect(setupForegroundNotifications).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deletes the latest rotated token when disabled while its POST is in progress", async () => {
    getToken.mockResolvedValue(TOKEN_B);
    let completePost!: (value: Response) => void;
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => { completePost = resolve; }),
    );
    const enabling = push.enablePushNotifications({ trigger: "automatic" });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    const disabling = push.disablePushNotifications();
    expect(push.getNotificationPreference()).toBe("disabled");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(deleteToken).not.toHaveBeenCalled();
    completePost(response());

    const results = await Promise.all([enabling, disabling]);
    expect(results[0]).toBeNull();

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/notifications/subscribe",
      expect.objectContaining({
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fcm_token: TOKEN_B }),
      }),
    );
    expect(deleteToken).toHaveBeenCalledOnce();
    expect(deleteToken.mock.invocationCallOrder[0]).toBeGreaterThan(
      fetchMock.mock.invocationCallOrder[1],
    );
    expect(localStorage.getItem(push.FCM_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(SYNCED_KEY)).toBeNull();
    expect(localStorage.getItem(RETRY_KEY)).toBeNull();
    expect(push.getNotificationPreference()).toBe("disabled");
  });

  it("cleans up instead of subscribing when manual permission is revoked during getToken", async () => {
    writeSynced();
    let completeToken!: (token: string) => void;
    getToken.mockImplementationOnce(
      () => new Promise<string>((resolve) => { completeToken = resolve; }),
    );
    const enabling = push.enablePushNotifications({ trigger: "manual" });
    await vi.waitFor(() => expect(getToken).toHaveBeenCalledOnce());
    vi.stubGlobal("Notification", { permission: "denied", requestPermission: vi.fn() });

    completeToken(TOKEN_B);
    await expect(enabling).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/notifications/subscribe", expect.objectContaining({
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fcm_token: TOKEN_A }),
    }));
    expect(deleteToken).toHaveBeenCalledOnce();
    expect(localStorage.getItem(push.FCM_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(SYNCED_KEY)).toBeNull();
    expect(push.getNotificationPreference()).toBe("disabled");
  });

  it("removes a just-saved token when manual permission is revoked during its POST", async () => {
    writeSynced();
    getToken.mockResolvedValue(TOKEN_B);
    let completePost!: (value: Response) => void;
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => { completePost = resolve; }),
    );
    const enabling = push.enablePushNotifications({ trigger: "manual" });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    vi.stubGlobal("Notification", { permission: "denied", requestPermission: vi.fn() });

    completePost(response());
    await expect(enabling).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/notifications/subscribe",
      expect.objectContaining({
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fcm_token: TOKEN_B }),
      }),
    );
    expect(deleteToken).toHaveBeenCalledOnce();
    expect(localStorage.getItem(push.FCM_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(SYNCED_KEY)).toBeNull();
    expect(push.getNotificationPreference()).toBe("disabled");
  });

  it("cancels an older manual operation when another tab changes the disable revision", async () => {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: vi.fn(async (...args: unknown[]) => {
          localStorage.setItem("notification_preference", "disabled");
          localStorage.setItem(
            "notification_disabled_revision",
            "disabled-by-another-tab",
          );
          const callback = args.at(-1) as () => Promise<unknown>;
          return callback();
        }),
      },
    });

    await expect(
      push.enablePushNotifications({ trigger: "manual" }),
    ).resolves.toBeNull();

    expect(getToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(push.getNotificationPreference()).toBe("disabled");
  });

  it("retains a possibly saved token after a POST timeout so disable removes it too", async () => {
    getToken.mockResolvedValue(TOKEN_B);
    fetchMock.mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));

    await expect(push.enablePushNotifications()).rejects.toThrow();

    expect(localStorage.getItem(push.FCM_TOKEN_KEY)).toBe(TOKEN_A);
    expect(localStorage.getItem("fcm_token_pending")).toBe(TOKEN_B);
    expect(localStorage.getItem(SYNCED_KEY)).toBeNull();

    await push.disablePushNotifications();

    const deletes = fetchMock.mock.calls.slice(1);
    expect(deletes).toHaveLength(2);
    expect(deletes.every((call) => call[1]?.method === "DELETE")).toBe(true);
    expect(
      deletes.map((call) => JSON.parse(call[1]?.body as string).fcm_token).sort(),
    ).toEqual([TOKEN_A, TOKEN_B].sort());
    expect(deleteToken).toHaveBeenCalledOnce();
    expect(localStorage.getItem(push.FCM_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem("fcm_token_pending")).toBeNull();
    expect(push.getNotificationPreference()).toBe("disabled");
  });

  it("aborts a stalled POST and lets opt-out clean up both tokens", async () => {
    vi.useFakeTimers();
    getToken.mockResolvedValue(TOKEN_B);
    fetchMock.mockImplementationOnce(() => new Promise<Response>(() => {}));
    const enabling = push.enablePushNotifications();
    const rejection = expect(enabling).rejects.toThrow("알림 서버 응답 시간이 초과되었습니다.");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const signal = fetchMock.mock.calls[0][1]?.signal as AbortSignal;
    const disabling = push.disablePushNotifications();
    expect(signal.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(10_000);
    await rejection;
    await disabling;

    expect(signal.aborted).toBe(true);
    const deletes = fetchMock.mock.calls.slice(1);
    expect(deletes.map((call) => JSON.parse(call[1]?.body as string).fcm_token).sort())
      .toEqual([TOKEN_A, TOKEN_B].sort());
    expect(deleteToken).toHaveBeenCalledOnce();
    expect(localStorage.getItem("fcm_token_pending")).toBeNull();
    expect(push.getNotificationPreference()).toBe("disabled");
  });

  it("releases the operation queue after getToken stalls for ten seconds", async () => {
    vi.useFakeTimers();
    getToken.mockImplementationOnce(() => new Promise<string>(() => {}));
    const enabling = push.enablePushNotifications({ trigger: "manual" });
    const rejection = expect(enabling).rejects.toThrow();
    await vi.waitFor(() => expect(getToken).toHaveBeenCalledOnce());

    const disabling = push.disablePushNotifications();
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_000);
    await rejection;
    await disabling;

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1]?.method).toBe("DELETE");
    expect(deleteToken).toHaveBeenCalledOnce();
    expect(push.getNotificationPreference()).toBe("disabled");
    expect(localStorage.getItem(push.FCM_TOKEN_KEY)).toBeNull();
  });

  it("honors a later manual enable queued while disable is still completing", async () => {
    writeSynced();
    let completeDelete!: (value: Response) => void;
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => { completeDelete = resolve; }),
    );
    const disabling = push.disablePushNotifications();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const disabledRevision = localStorage.getItem("notification_disabled_revision");
    getToken.mockResolvedValue(TOKEN_B);

    const enabling = push.enablePushNotifications({ trigger: "manual" });
    expect(getToken).not.toHaveBeenCalled();
    completeDelete(response());

    await disabling;
    await expect(enabling).resolves.toBe(TOKEN_B);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]?.method).toBe("POST");
    expect(localStorage.getItem(push.FCM_TOKEN_KEY)).toBe(TOKEN_B);
    expect(readSynced()).toEqual({ token: TOKEN_B, savedAt: NOW });
    expect(push.getNotificationPreference()).toBe("enabled");
    expect(localStorage.getItem("notification_disabled_revision")).toBe(
      disabledRevision,
    );
  });

  it("skips automatic initialization after the user disables notifications", async () => {
    localStorage.setItem("notification_preference", "disabled");

    await expect(
      push.enablePushNotifications({ trigger: "automatic" }),
    ).resolves.toBeNull();

    expect(getToken).not.toHaveBeenCalled();
    expect(setupForegroundNotifications).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(push.getNotificationPreference()).toBe("disabled");
  });

  it("allows an explicit manual enable after notifications were disabled", async () => {
    localStorage.setItem("notification_preference", "disabled");
    localStorage.removeItem(push.FCM_TOKEN_KEY);

    await expect(
      push.enablePushNotifications({ trigger: "manual" }),
    ).resolves.toBe(TOKEN_A);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(push.getNotificationPreference()).toBe("enabled");
  });

  it("disables locally and clears synchronization records even when the server rejects unsubscribe", async () => {
    writeSynced();
    localStorage.setItem(
      RETRY_KEY,
      JSON.stringify({
        token: TOKEN_A,
        scope: "subscribe-token-ip",
        retryAt: NOW + 120_000,
      }),
    );
    fetchMock.mockResolvedValue(response(429));

    await expect(push.disablePushNotifications()).rejects.toThrow(
      "서버의 알림 토큰을 제거하지 못했습니다.",
    );

    expect(push.getNotificationPreference()).toBe("disabled");
    expect(localStorage.getItem(push.FCM_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(SYNCED_KEY)).toBeNull();
    expect(localStorage.getItem(RETRY_KEY)).toBeNull();
    expect(deleteToken).toHaveBeenCalledOnce();
  });

  it("disables locally when the unsubscribe request cannot connect", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    await expect(push.disablePushNotifications()).rejects.toThrow();
    expect(push.getNotificationPreference()).toBe("disabled");
    expect(localStorage.getItem(push.FCM_TOKEN_KEY)).toBeNull();
    expect(deleteToken).toHaveBeenCalledOnce();
  });

  it("reports the failing FCM step without including a token", async () => {
    const tokenError = Object.assign(new Error("subscription failed"), {
      code: "messaging/token-subscribe-failed",
    });
    getToken.mockRejectedValue(tokenError);

    await expect(push.enablePushNotifications()).rejects.toBe(tokenError);

    expect(captureException).toHaveBeenCalledWith(tokenError, {
      tags: {
        feature: "push-notifications",
        step: "requesting-fcm-token",
        permission: "granted",
        trigger: "manual",
        firebase_error_code: "messaging/token-subscribe-failed",
      },
    });
    expect(JSON.stringify(captureException.mock.calls)).not.toContain(
      "fcm_token",
    );
  });
});
