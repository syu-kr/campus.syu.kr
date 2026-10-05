import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "./LocaleProvider";
import { NotificationPermissionPrompt } from "./NotificationPermissionPrompt";
import { dictionaries, type Locale } from "@/lib/i18n";
import {
  enablePushNotifications,
  PushSubscriptionError,
} from "@/lib/push-notifications";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/push-notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/push-notifications")>()),
  enablePushNotifications: vi.fn(),
  getNotificationPreference: vi.fn(() => null),
  setNotificationPreference: vi.fn(),
}));

function renderPrompt(locale: Locale = "ko") {
  return render(
    <LocaleProvider locale={locale}>
      <NotificationPermissionPrompt />
    </LocaleProvider>,
  );
}

describe("NotificationPermissionPrompt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
    vi.mocked(enablePushNotifications).mockReset();
    localStorage.clear();
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "default" },
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {},
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for user interaction before showing the prompt", () => {
    renderPrompt();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    fireEvent.scroll(window);
    expect(screen.getByRole("heading")).toBeInTheDocument();
  });

  it.each(["ko", "en"] as const)(
    "shows a %s retry time and enables retry at the deadline without another request",
    async (locale) => {
      const text = dictionaries[locale].notificationPrompt;
      const retryAt = Date.now() + 60_000;
      vi.mocked(enablePushNotifications).mockRejectedValue(
        new PushSubscriptionError(429, retryAt, "subscribe-token-ip"),
      );
      renderPrompt(locale);
      fireEvent.scroll(window);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: text.enable }));
      });

      expect(
        screen.getByText(
          text.rateLimited.replace(
            "{time}",
            new Date(retryAt).toLocaleString(locale === "ko" ? "ko-KR" : "en-US"),
          ),
        ),
      ).toBeInTheDocument();
      const retryButton = screen.getByRole("button", { name: text.enable });
      expect(retryButton).toBeDisabled();
      expect(screen.getByRole("button", { name: text.dismiss })).toBeEnabled();
      fireEvent.click(retryButton);
      expect(enablePushNotifications).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(59_999);
      });
      expect(retryButton).toBeDisabled();
      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(retryButton).toBeEnabled();
      expect(enablePushNotifications).toHaveBeenCalledTimes(1);
    },
  );
});
