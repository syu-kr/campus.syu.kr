"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { Icon } from "@/app/components/Icon";
import {
  FCM_TOKEN_KEY,
  disablePushNotifications,
  enablePushNotifications,
  type PushNotificationStatus,
} from "@/lib/push-notifications";

type PermissionState = "granted" | "denied" | "default" | "unsupported";

const permissionLabels: Record<PermissionState, string> = {
  granted: "알림 허용됨",
  denied: "알림 차단됨",
  default: "아직 선택하지 않음",
  unsupported: "이 브라우저에서 지원하지 않음",
};

const statusLabels: Record<PushNotificationStatus, string> = {
  "requesting-permission":
    "브라우저 알림 권한을 확인하고 있습니다. 권한 요청창이 보이지 않으면 브라우저 설정을 확인해주세요.",
  "registering-service-worker": "알림 서비스 워커를 등록하고 있습니다.",
  "initializing-firebase": "Firebase 알림 서비스를 초기화하고 있습니다.",
  "requesting-fcm-token": "FCM 토큰을 발급하고 있습니다.",
  "saving-fcm-token": "발급된 FCM 토큰을 서버에 저장하고 있습니다.",
  enabled: "알림 설정과 FCM 구독이 완료되었습니다.",
};

export default function NotificationPrivacyPage() {
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
        onStatus: (status) => setMessage(statusLabels[status]),
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "알림 설정 중 오류가 발생했습니다.",
      );
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
      setMessage(
        "FCM 알림 구독을 해제했습니다. 브라우저 알림 권한은 그대로 유지됩니다.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "알림 구독 해제 중 오류가 발생했습니다.",
      );
    } finally {
      refreshStatus();
      setIsProcessing(false);
    }
  };

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <Link
          href="/more"
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          <Icon name="chevron-right" size={16} className="rotate-180" />
          더보기
        </Link>
        <h1 className="mb-2 text-2xl font-bold text-neutral-900 sm:text-3xl">
          알림 및 개인정보
        </h1>
        <p className="text-neutral-600">
          알림 권한, 분석 도구, 개인정보 안내를 한곳에서 확인하세요.
        </p>
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
                브라우저 알림 및 FCM 구독 상태
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                브라우저 알림 권한:{" "}
                <strong className="text-neutral-900">
                  {isReady ? permissionLabels[permission] : "확인 중"}
                </strong>
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                FCM 토큰:{" "}
                <strong className="text-neutral-900">
                  {isReady
                    ? hasToken
                      ? "발급 및 구독됨"
                      : "발급되지 않음"
                    : "확인 중"}
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
                      {isProcessing
                        ? "설정 중..."
                        : "알림 설정 및 FCM 토큰 발급"}
                    </button>
                  )}
                  {hasToken && (
                    <button
                      type="button"
                      onClick={handleDisable}
                      disabled={isProcessing}
                      className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isProcessing ? "해제 중..." : "FCM 알림 구독 해제"}
                    </button>
                  )}
                </div>
              )}

              {isReady && permission === "denied" && (
                <p className="mt-3 text-sm leading-6 text-amber-700">
                  브라우저에서 알림이 차단되어 있습니다. 브라우저 설정에서
                  권한을 허용한 뒤 FCM 토큰을 발급해주세요.
                </p>
              )}
              {isReady && permission === "granted" && !hasToken && (
                <p className="mt-3 text-sm leading-6 text-neutral-500">
                  브라우저 권한은 허용되어 있지만 FCM 토큰이 없어 알림은
                  전송되지 않습니다.
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card hover={false} className="border border-neutral-200">
          <h2 className="text-base font-semibold text-neutral-900">
            분석 도구 사용
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            서비스 품질 개선과 오류 파악을 위해 Google Analytics가 사용됩니다.
            분석 데이터는 개인정보처리방침의 목적과 범위 안에서 다룹니다.
          </p>
          <Link
            href="/privacy"
            className="mt-4 inline-flex rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50"
          >
            개인정보처리방침 보기
          </Link>
        </Card>

        <Card hover={false} className="border border-neutral-200 bg-neutral-50">
          <h2 className="text-base font-semibold text-neutral-900">
            권한 요청 원칙
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            SYU CAMPUS는 사용자의 명시적인 브라우저 권한 없이는 푸시 알림을 보낼
            수 없습니다. 이미 알림을 허용한 경우에만 알림 토큰을 등록해 서비스
            공지를 받을 수 있게 합니다.
          </p>
        </Card>
      </div>
    </Container>
  );
}
