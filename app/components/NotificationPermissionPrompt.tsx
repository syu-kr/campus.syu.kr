"use client";

import { useEffect, useState } from "react";
import {
  FCM_TOKEN_KEY,
  enablePushNotifications,
  getNotificationPreference,
  setNotificationPreference,
  type PushNotificationStatus,
} from "@/lib/push-notifications";

const statusLabels: Record<PushNotificationStatus, string> = {
  "requesting-permission":
    "브라우저 알림 권한을 확인하고 있습니다. 권한 요청창이 보이지 않으면 브라우저 설정을 확인해주세요.",
  "registering-service-worker": "알림 서비스 워커를 등록하고 있습니다.",
  "initializing-firebase": "Firebase 알림 서비스를 초기화하고 있습니다.",
  "requesting-fcm-token": "FCM 토큰을 발급하고 있습니다.",
  "saving-fcm-token": "발급된 FCM 토큰을 서버에 저장하고 있습니다.",
  enabled: "알림 설정이 완료되었습니다.",
};

export function NotificationPermissionPrompt() {
  const [isVisible, setIsVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      localStorage.getItem(FCM_TOKEN_KEY) ||
      getNotificationPreference()
    ) {
      return;
    }

    setIsVisible(true);
  }, []);

  const handleEnable = async () => {
    setIsProcessing(true);
    setMessage("");

    try {
      await enablePushNotifications({
        onStatus: (status) => setMessage(statusLabels[status]),
      });
      setIsVisible(false);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "알림 설정 중 오류가 발생했습니다.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismiss = () => {
    setNotificationPreference("disabled");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-permission-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <h2
          id="notification-permission-title"
          className="text-lg font-bold text-neutral-900"
        >
          새 소식을 알림으로 받아보시겠어요?
        </h2>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          서비스 공지와 주요 캠퍼스 소식을 브라우저 알림으로 받을 수 있습니다.
          알림 설정은 알림 및 개인정보 페이지에서 언제든지 변경할 수 있습니다.
        </p>
        {message && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {message}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isProcessing}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          >
            알림 받지 않기
          </button>
          <button
            type="button"
            onClick={handleEnable}
            disabled={isProcessing}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {isProcessing ? "설정 중..." : "알림 설정"}
          </button>
        </div>
      </div>
    </div>
  );
}
