"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  FCM_TOKEN_KEY,
  PushSubscriptionError,
  enablePushNotifications,
  getNotificationPreference,
  setNotificationPreference,
} from "@/lib/push-notifications";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";

export function NotificationPermissionPrompt() {
  const dictionary = useDictionary();
  const locale = useLocale();
  const isRoommatePage = /^\/(?:en\/)?campus\/roommates(?:\/|$)/.test(usePathname());
  const [isVisible, setIsVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [retryAt, setRetryAt] = useState<number | null>(null);

  useEffect(() => {
    if (retryAt === null) return;
    const timeout = window.setTimeout(
      () => setRetryAt(null),
      Math.max(0, retryAt - Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [retryAt]);

  useEffect(() => {
    if (isRoommatePage) return;
    const permission = "Notification" in window ? Notification.permission : null;

    if (
      !permission ||
      !("serviceWorker" in navigator) ||
      permission === "denied" ||
      localStorage.getItem(FCM_TOKEN_KEY) ||
      getNotificationPreference()
    ) {
      return;
    }

    const showPrompt = () => {
      setIsVisible(true);
      window.removeEventListener("pointerdown", showPrompt);
      window.removeEventListener("keydown", showPrompt);
      window.removeEventListener("scroll", showPrompt);
    };

    window.addEventListener("pointerdown", showPrompt, { once: true });
    window.addEventListener("keydown", showPrompt, { once: true });
    window.addEventListener("scroll", showPrompt, {
      once: true,
      passive: true,
    });

    return () => {
      window.removeEventListener("pointerdown", showPrompt);
      window.removeEventListener("keydown", showPrompt);
      window.removeEventListener("scroll", showPrompt);
    };
  }, [isRoommatePage]);

  const handleEnable = async () => {
    setIsProcessing(true);
    setMessage("");

    try {
      await enablePushNotifications({
        onStatus: (status) =>
          setMessage(dictionary.notificationPrompt.statusMessages[status]),
      });
      setRetryAt(null);
      setIsVisible(false);
    } catch (error) {
      if (error instanceof PushSubscriptionError && error.status === 429) {
        const deadline = error.retryAt ?? Date.now() + 60_000;
        setRetryAt(deadline);
        setMessage(
          dictionary.notificationPrompt.rateLimited.replace(
            "{time}",
            new Date(deadline).toLocaleString(locale === "ko" ? "ko-KR" : "en-US"),
          ),
        );
      } else {
        setMessage(
          error instanceof Error
            ? error.message
            : dictionary.notificationPrompt.errorFallback,
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismiss = () => {
    setNotificationPreference("disabled");
    setIsVisible(false);
  };

  if (!isVisible || isRoommatePage) return null;

  return (
    <section
      className="relative mx-4 my-4 md:fixed md:inset-x-auto md:bottom-6 md:right-6 md:z-40 md:m-0 md:w-[min(28rem,calc(100vw-3rem))]"
      aria-labelledby="notification-permission-title"
    >
      <div className="min-w-0 overflow-hidden rounded-xl border border-primary-100 bg-white p-4 shadow-2xl sm:p-5">
        <h2
          id="notification-permission-title"
          className="text-base font-bold text-neutral-900 sm:text-lg"
        >
          {dictionary.notificationPrompt.title}
        </h2>
        <p className="mt-2 break-keep text-sm leading-6 text-neutral-600">
          {dictionary.notificationPrompt.description}
        </p>
        {message && (
          <p
            className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"
            aria-live="polite"
          >
            {message}
          </p>
        )}
        <div className="mt-4 grid gap-2 sm:flex sm:justify-end">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isProcessing}
            className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 sm:w-auto"
          >
            {dictionary.notificationPrompt.dismiss}
          </button>
          <button
            type="button"
            onClick={handleEnable}
            disabled={isProcessing || retryAt !== null}
            className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60 sm:w-auto"
          >
            {isProcessing
              ? dictionary.notificationPrompt.processing
              : dictionary.notificationPrompt.enable}
          </button>
        </div>
      </div>
    </section>
  );
}
