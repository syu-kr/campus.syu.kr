import { describe, expect, it, vi } from "vitest";
import { dictionaries } from "@/lib/i18n";
import { getPushErrorMessage } from "./push-notification-messages";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

describe.each(["ko", "en"] as const)("%s notification messages", (locale) => {
  const text = dictionaries[locale].pages.notificationPrivacy;

  it.each([
    ["알림 토큰을 발급하지 못했습니다.", "tokenFailed"],
    ["알림 서버 응답 시간이 초과되었습니다.", "serverTimeout"],
  ] as const)("translates %s without changing the diagnostic error", (message, key) => {
    const error = new Error(message);
    expect(getPushErrorMessage(error, text, text.enableError, locale)).toBe(text.errors[key]);
    expect(error.message).toBe(message);
  });

  it.each([new Error("FirebaseError: messaging/unknown-sdk-error"), null])(
    "uses a helpful fallback for unknown failures (%s)", (error) => {
      expect(getPushErrorMessage(error, text, text.enableError, locale)).toBe(text.enableError);
    },
  );
});
