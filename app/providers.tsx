"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect } from "react";
import { NotificationModal } from "@/components/NotificationModal";

// QueryClient를 싱글톤으로 관리
let clientSingleton: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // 서버: 항상 새로운 인스턴스 생성
    return new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 0,
          gcTime: 5 * 60 * 1000,
        },
      },
    });
  }

  // 브라우저: 싱글톤 사용
  if (!clientSingleton) {
    clientSingleton = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 0,
          gcTime: 5 * 60 * 1000,
        },
      },
    });
  }

  return clientSingleton;
}

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const queryClient = getQueryClient();

  useEffect(() => {
    initializePushNotifications();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <NotificationModal />
      {children}
    </QueryClientProvider>
  );
}

async function initializePushNotifications() {
  if (typeof window === "undefined") {
    return;
  }

  let swRegistration: ServiceWorkerRegistration | null = null;
  if ("serviceWorker" in navigator) {
    try {
      swRegistration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
    } finally {
      // Error handling - silently fail
    }
  } else {
    return;
  }

  // Firebase 포그라운드 핸들러 설정
  await setupForegroundNotifications();

  const permission = Notification.permission;

  if (permission === "granted") {
    generateAndSaveFCMToken(swRegistration);
  } else if (permission === "default") {
    showPermissionRequest(swRegistration);
  }
}

async function generateAndSaveFCMToken(
  swRegistration: ServiceWorkerRegistration | null,
) {
  try {
    const { getToken } = await import("firebase/messaging");
    const { messaging } = await import("@/lib/firebase");

    if (!messaging) {
      return;
    }

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

    const tokenOptions: {
      serviceWorkerRegistration?: ServiceWorkerRegistration;
      vapidKey?: string;
    } = {};

    if (swRegistration) {
      tokenOptions.serviceWorkerRegistration = swRegistration;
    }

    if (vapidKey) {
      tokenOptions.vapidKey = vapidKey;
    }

    const token = await getToken(messaging, tokenOptions);

    if (token) {
      await saveFCMToken(token);
    }
  } finally {
    // Error handling - silently fail
  }
}

function showPermissionRequest(
  swRegistration: ServiceWorkerRegistration | null,
) {
  setTimeout(() => {
    const userWantsNotification = confirm(
      "새로운 공지사항을 놓치지 않으려면 알림을 켜시겠어요?",
    );

    if (userWantsNotification) {
      requestNotificationPermission(swRegistration);
    }
  }, 500);
}

async function requestNotificationPermission(
  swRegistration: ServiceWorkerRegistration | null,
) {
  try {
    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      generateAndSaveFCMToken(swRegistration);
    }
  } finally {
    // Error handling - silently fail
  }
}

async function saveFCMToken(token: string) {
  try {
    console.log("[FCM] 토큰 저장 시작:", {
      token_length: token.length,
      token_preview: token.substring(0, 30) + "...",
      vapid_key:
        process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.substring(0, 30) + "...",
    });

    const response = await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fcm_token: token }),
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem("fcm_token", token);
      console.log("[FCM] 토큰 저장 성공:", data);
    } else {
      const errorText = await response.text();
      console.warn("[FCM] 토큰 저장 실패:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
    }
  } catch (error) {
    console.warn("[FCM] 토큰 저장 예외:", error);
  } finally {
    // Error handling - silently fail
  }
}

async function setupForegroundNotifications() {
  try {
    const { setupForegroundNotifications: setup } =
      await import("@/lib/firebase");
    await setup();
  } catch (error) {
    console.warn("[FCM] 포그라운드 알림 설정 실패:", error);
  }
}
