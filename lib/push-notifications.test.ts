import { beforeEach, describe, expect, it, vi } from "vitest";

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

import {
  disablePushNotifications,
  enablePushNotifications,
  FCM_TOKEN_KEY,
  getNotificationPreference,
} from "./push-notifications";

describe("push notifications", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(FCM_TOKEN_KEY, "token-value-long-enough-for-testing");
    deleteToken.mockReset();
    deleteToken.mockResolvedValue(true);
    getToken.mockReset();
    isSupported.mockReset();
    isSupported.mockResolvedValue(true);
    setupForegroundNotifications.mockReset();
    captureException.mockReset();
  });

  it("disables locally even when the server rejects unsubscribe", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false }),
    );

    await expect(disablePushNotifications()).rejects.toThrow(
      "서버의 알림 토큰을 제거하지 못했습니다.",
    );

    expect(getNotificationPreference()).toBe("disabled");
    expect(localStorage.getItem(FCM_TOKEN_KEY)).toBeNull();
    expect(deleteToken).toHaveBeenCalledOnce();
  });

  it("disables locally when the unsubscribe request cannot connect", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(disablePushNotifications()).rejects.toThrow();
    expect(getNotificationPreference()).toBe("disabled");
    expect(localStorage.getItem(FCM_TOKEN_KEY)).toBeNull();
    expect(deleteToken).toHaveBeenCalledOnce();
  });

  it("reports the failing FCM step without including a token", async () => {
    const tokenError = Object.assign(new Error("subscription failed"), {
      code: "messaging/token-subscribe-failed",
    });
    const register = vi.fn().mockResolvedValue({ scope: "/" });

    vi.stubEnv("NEXT_PUBLIC_FIREBASE_VAPID_KEY", "test-vapid-key");
    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission: vi.fn(),
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({}), register },
    });
    getToken.mockRejectedValue(tokenError);

    await expect(enablePushNotifications()).rejects.toBe(tokenError);

    expect(captureException).toHaveBeenCalledWith(tokenError, {
      tags: {
        feature: "push-notifications",
        step: "requesting-fcm-token",
        permission: "granted",
        firebase_error_code: "messaging/token-subscribe-failed",
      },
    });
    expect(JSON.stringify(captureException.mock.calls)).not.toContain(
      "fcm_token",
    );
  });
});
