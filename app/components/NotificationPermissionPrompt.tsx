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
import { Button } from "./Button";

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
      window.removeEventListener("click", showPrompt);
      window.removeEventListener("keyup", showPrompt);
      window.removeEventListener("scroll", showPrompt);
    };

    window.addEventListener("click", showPrompt, { once: true });
    window.addEventListener("keyup", showPrompt, { once: true });
    window.addEventListener("scroll", showPrompt, {
      once: true,
      passive: true,
    });

    return () => {
      window.removeEventListener("click", showPrompt);
      window.removeEventListener("keyup", showPrompt);
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
      className="mx-auto my-4 max-w-4xl px-4"
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
          <Button
            variant="secondary"
            type="button"
            onClick={handleDismiss}
            disabled={isProcessing}
            className="w-full sm:w-auto"
          >
            {dictionary.notificationPrompt.dismiss}
          </Button>
          <Button
            type="button"
            onClick={handleEnable}
            disabled={isProcessing || retryAt !== null}
            className="w-full sm:w-auto"
          >
            {isProcessing
              ? dictionary.notificationPrompt.processing
              : dictionary.notificationPrompt.enable}
          </Button>
        </div>
      </div>
    </section>
  );
}
