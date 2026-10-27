"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { Icon } from "@/app/components/Icon";
import {
  useDictionary,
  useLocale,
} from "@/app/components/LocaleProvider";
import {
  FCM_TOKEN_KEY,
  PushSubscriptionError,
  disablePushNotifications,
  enablePushNotifications,
  type PushNotificationStatus,
} from "@/lib/push-notifications";
import { getPushErrorMessage } from "@/lib/push-notification-messages";
import { localizePath, type Dictionary } from "@/lib/i18n";

type PermissionState = "granted" | "denied" | "default" | "unsupported";
type NotificationPrivacyDictionary =
  Dictionary["pages"]["notificationPrivacy"];

export default function NotificationPrivacyPage() {
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.pages.notificationPrivacy;
  const [isReady, setIsReady] = useState(false);
  const [permission, setPermission] = useState<PermissionState>("unsupported");
  const [hasToken, setHasToken] = useState(false);
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

  const refreshStatus = () => {
    setPermission(
      "Notification" in window
        ? (Notification.permission as PermissionState)
        : "unsupported",
    );
    setHasToken(Boolean(localStorage.getItem(FCM_TOKEN_KEY)));
  };

  useEffect(() => {
    refreshStatus();
    setIsReady(true);
  }, []);

  const handleEnable = async () => {
    setIsProcessing(true);
    setMessage("");

    try {
      await enablePushNotifications({
        onStatus: (status) => setMessage(getStatusLabel(status, text)),
      });
      setRetryAt(null);
    } catch (error) {
      if (error instanceof PushSubscriptionError && error.status === 429) {
        setRetryAt(error.retryAt ?? Date.now() + 60_000);
      }
      setMessage(getPushErrorMessage(error, text, text.enableError, locale));
    } finally {
      refreshStatus();
      setIsProcessing(false);
    }
  };

  const handleDisable = async () => {
    setIsProcessing(true);
    setMessage("");

    try {
      await disablePushNotifications();
      setMessage(text.disableSuccess);
    } catch (error) {
      setMessage(getPushErrorMessage(error, text, text.disableError, locale));
    } finally {
      setRetryAt(null);
      refreshStatus();
      setIsProcessing(false);
    }
  };

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-neutral-900 sm:text-3xl">
          {text.title}
        </h1>
        <p className="text-neutral-600">{text.description}</p>
      </div>

      <div className="grid gap-4">
        <Card hover={false} className="border border-neutral-200">
          <div className="flex items-start gap-3">
            <Icon
              name="info"
              size={22}
              color="rgb(37, 99, 235)"
              className="mt-0.5 flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-neutral-900">
                {text.statusTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                {text.permissionLabel}:{" "}
                <strong className="text-neutral-900">
                  {isReady
                    ? getPermissionLabel(permission, text)
                    : text.checking}
                </strong>
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                {text.tokenLabel}:{" "}
                <strong className="text-neutral-900">
                  {isReady
                    ? hasToken
                      ? text.tokenSubscribed
                      : text.tokenMissing
                    : text.checking}
                </strong>
              </p>

              {message && (
                <p
                  className="mt-3 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700"
                  aria-live="polite"
                >
                  {message}
                </p>
              )}

              {isReady && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {!hasToken && permission !== "unsupported" && (
                    <button
                      type="button"
                      onClick={handleEnable}
                      disabled={
                        isProcessing || retryAt !== null || permission === "denied"
                      }
                      className="ui-button ui-button-primary rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isProcessing ? text.enableProcessing : text.enableAction}
                    </button>
                  )}
                  {hasToken && (
                    <button
                      type="button"
                      onClick={handleDisable}
                      disabled={isProcessing}
                      className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isProcessing
                        ? text.disableProcessing
                        : text.disableAction}
                    </button>
                  )}
                </div>
              )}

              {isReady && permission === "denied" && (
                <p className="mt-3 text-sm leading-6 text-amber-700">
                  {text.deniedHelp}
                </p>
              )}
              {isReady && permission === "granted" && !hasToken && (
                <p className="mt-3 text-sm leading-6 text-neutral-500">
                  {text.missingTokenHelp}
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card hover={false} className="border border-neutral-200">
          <h2 className="text-base font-semibold text-neutral-900">
            {text.analyticsTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            {text.analyticsDescription}
          </p>
          <Link
            href={localizePath("/privacy", locale)}
            className="mt-4 inline-flex rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50"
          >
            {text.privacyPolicyLink}
          </Link>
        </Card>

        <Card hover={false} className="border border-neutral-200 bg-neutral-50">
          <h2 className="text-base font-semibold text-neutral-900">
            {text.permissionPrincipleTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            {text.permissionPrincipleDescription}
          </p>
        </Card>
      </div>
    </Container>
  );
}

function getPermissionLabel(
  permission: PermissionState,
  text: NotificationPrivacyDictionary,
): string {
  if (permission === "granted") return text.permissionStates.granted;
  if (permission === "denied") return text.permissionStates.denied;
  if (permission === "default") return text.permissionStates.default;
  return text.permissionStates.unsupported;
}

function getStatusLabel(
  status: PushNotificationStatus,
  text: NotificationPrivacyDictionary,
): string {
  if (status === "requesting-permission") {
    return text.statusMessages.requestingPermission;
  }
  if (status === "registering-service-worker") {
    return text.statusMessages.registeringServiceWorker;
  }
  if (status === "initializing-firebase") {
    return text.statusMessages.initializingFirebase;
  }
  if (status === "requesting-fcm-token") {
    return text.statusMessages.requestingFcmToken;
  }
  if (status === "saving-fcm-token") {
    return text.statusMessages.savingFcmToken;
  }
  return text.statusMessages.enabled;
}
