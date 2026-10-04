import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NotificationPrivacyPage from "./page";
import { LocaleProvider } from "@/app/components/LocaleProvider";
import { dictionaries, type Locale } from "@/lib/i18n";
import {
  disablePushNotifications,
  enablePushNotifications,
  FCM_TOKEN_KEY,
  PushSubscriptionError,
} from "@/lib/push-notifications";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/push-notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/push-notifications")>()),
  enablePushNotifications: vi.fn(),
  disablePushNotifications: vi.fn(),
}));

function renderPage(locale: Locale = "ko") {
  return render(
    <LocaleProvider locale={locale}>
      <NotificationPrivacyPage />
    </LocaleProvider>,
  );
}

describe("NotificationPrivacyPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
    vi.mocked(enablePushNotifications).mockReset();
    vi.mocked(disablePushNotifications).mockReset();
    localStorage.clear();
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "granted" },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["ko", "en"] as const)(
    "shows a %s retry deadline and keeps a failed new subscription inactive",
    async (locale) => {
      const text = dictionaries[locale].pages.notificationPrivacy;
      const retryAt = Date.now() + 60_000;
      vi.mocked(enablePushNotifications).mockRejectedValue(
        new PushSubscriptionError(429, retryAt, "subscribe-token-ip", true),
      );
      renderPage(locale);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: text.enableAction }));
      });

      expect(
        screen.getByText(
          text.rateLimited.replace(
            "{time}",
            new Date(retryAt).toLocaleString(locale === "ko" ? "ko-KR" : "en-US"),
          ),
        ),
      ).toBeInTheDocument();
      expect(screen.getByText(text.tokenMissing)).toBeInTheDocument();
      const retryButton = screen.getByRole("button", { name: text.enableAction });
      expect(retryButton).toBeDisabled();
      fireEvent.click(retryButton);
      expect(enablePushNotifications).toHaveBeenCalledTimes(1);
      await act(async () => {
        vi.advanceTimersByTime(60_000);
      });
      expect(retryButton).toBeEnabled();
      expect(enablePushNotifications).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps the existing token and lets the user unsubscribe during subscribe cooldown", async () => {
    const text = dictionaries.ko.pages.notificationPrivacy;
    vi.mocked(enablePushNotifications).mockImplementation(async () => {
      localStorage.setItem(FCM_TOKEN_KEY, "existing-token");
      throw new PushSubscriptionError(429, Date.now() + 60_000, "subscribe-token-ip");
    });
    vi.mocked(disablePushNotifications).mockImplementation(async () => {
      localStorage.removeItem(FCM_TOKEN_KEY);
    });
    renderPage();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: text.enableAction }));
    });

    expect(screen.getByText(text.tokenSubscribed)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: text.disableAction })).toBeEnabled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: text.disableAction }));
    });
    expect(disablePushNotifications).toHaveBeenCalledTimes(1);
    expect(screen.getByText(text.tokenMissing)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: text.enableAction })).toBeEnabled();
  });
});
