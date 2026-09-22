import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationPermissionPrompt } from "./NotificationPermissionPrompt";

vi.mock("@/lib/push-notifications", () => ({
  FCM_TOKEN_KEY: "fcm_token",
  enablePushNotifications: vi.fn(),
  getNotificationPreference: vi.fn(() => null),
  setNotificationPreference: vi.fn(),
}));

describe("NotificationPermissionPrompt", () => {
  beforeEach(() => {
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

  it("waits for user interaction before showing the prompt", () => {
    render(<NotificationPermissionPrompt />);

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();

    fireEvent.scroll(window);

    expect(screen.getByRole("heading")).toBeInTheDocument();
  });
});
