import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteToken = vi.fn();

vi.mock("firebase/messaging", () => ({ deleteToken }));
vi.mock("@/lib/firebase", () => ({ messaging: {} }));

import {
  disablePushNotifications,
  FCM_TOKEN_KEY,
  getNotificationPreference,
} from "./push-notifications";

describe("disablePushNotifications", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(FCM_TOKEN_KEY, "token-value-long-enough-for-testing");
    deleteToken.mockReset();
    deleteToken.mockResolvedValue(true);
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
});
