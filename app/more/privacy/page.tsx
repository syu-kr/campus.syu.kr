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
  disablePushNotifications,
  enablePushNotifications,
  type PushNotificationStatus,
} from "@/lib/push-notifications";
import { localizePath, type Dictionary } from "@/lib/i18n";

type PermissionState = "granted" | "denied" | "default" | "unsupported";
type NotificationPrivacyDictionary =
  Dictionary["pages"]["notificationPrivacy"];

const pushErrorKeys: Record<
  string,
  keyof NotificationPrivacyDictionary["errors"]
> = {
  "이 브라우저에서는 알림을 지원하지 않습니다.": "unsupported",
  "브라우저에서 알림 권한이 차단되었습니다.": "denied",
  "브라우저 알림 권한이 허용되지 않았습니다.": "notAllowed",
  "브라우저가 알림 권한 요청창을 표시하지 않았습니다. 브라우저 설정에서 알림을 허용한 뒤 다시 시도해주세요.":
    "permissionTimeout",
  "이 브라우저에서는 Firebase 알림을 지원하지 않습니다.":
    "firebaseUnsupported",
  "알림 서비스를 초기화하지 못했습니다.": "initFailed",
  "Firebase VAPID 키가 설정되지 않았습니다.": "vapidMissing",
  "알림 토큰을 발급하지 못했습니다.": "tokenFailed",
  "알림 토큰을 저장하지 못했습니다.": "saveFailed",
  "서버의 알림 토큰을 제거하지 못했습니다.": "deleteFailed",
  "알림 서비스 워커 준비 시간이 초과되었습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.":
    "workerTimeout",
};

export default function NotificationPrivacyPage() {
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.pages.notificationPrivacy;
  const [isReady, setIsReady] = useState(false);
  const [permission, setPermission] = useState<PermissionState>("unsupported");
  const [hasToken, setHasToken] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState("");

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
    } catch (error) {
      setMessage(getPushErrorMessage(error, text, text.enableError));
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
      setMessage(getPushErrorMessage(error, text, text.disableError));
    } finally {
      refreshStatus();
      setIsProcessing(false);
    }
  };

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <Link
          href={localizePath("/more", locale)}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          <Icon name="chevron-right" size={16} className="rotate-180" />
          {text.backToMore}
        </Link>
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
                <p className="mt-3 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
                  {message}
                </p>
              )}

              {isReady && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {!hasToken && permission !== "unsupported" && (
                    <button
                      type="button"
                      onClick={handleEnable}
                      disabled={isProcessing || permission === "denied"}
                      className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
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

function getPushErrorMessage(
  error: unknown,
  text: NotificationPrivacyDictionary,
  fallback: string,
): string {
  if (!(error instanceof Error)) return fallback;

  const key = pushErrorKeys[error.message];
  return key ? text.errors[key] : fallback;
}
