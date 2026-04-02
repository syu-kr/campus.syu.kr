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
    const response = await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fcm_token: token }),
    });

    if (response.ok) {
      localStorage.setItem("fcm_token", token);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    // Error handling - silently fail
  } finally {
    // Error handling - silently fail
  }
}

async function setupForegroundNotifications() {
  try {
    const { setupForegroundNotifications: setup } =
      await import("@/lib/firebase");
    await setup();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    // Error handling - silently fail
  }
}
