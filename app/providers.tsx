"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect } from "react";
import { NotificationModal } from "@/components/NotificationModal";

let clientSingleton: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
          gcTime: 5 * 60 * 1000,
          refetchOnWindowFocus: false,
        },
      },
    });
  }

  if (!clientSingleton) {
    clientSingleton = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
          gcTime: 5 * 60 * 1000,
          refetchOnWindowFocus: false,
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
    const cancelIdleTask = scheduleIdleTask(() => {
      initializePushNotifications();
    });

    return cancelIdleTask;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <NotificationModal />
      {children}
    </QueryClientProvider>
  );
}

function scheduleIdleTask(task: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const idleCallback = window.requestIdleCallback;
  if (idleCallback) {
    const id = idleCallback(task, { timeout: 5000 });
    return () => window.cancelIdleCallback?.(id);
  }

  const timeoutId = window.setTimeout(task, 3000);
  return () => window.clearTimeout(timeoutId);
}

async function initializePushNotifications() {
  if (typeof window === "undefined") {
    return;
  }

  let swRegistration: ServiceWorkerRegistration | null = null;
  if ("serviceWorker" in navigator) {
    swRegistration = await navigator.serviceWorker.register("/sw.js", {
      updateViaCache: "none",
    });
    setupServiceWorkerUpdateReload(swRegistration);
    await swRegistration.update();
    await navigator.serviceWorker.ready;
  } else {
    return;
  }

  const permission = Notification.permission;

  if (permission === "granted") {
    await setupForegroundNotifications();
    generateAndSaveFCMToken(swRegistration);
  }
}

function setupServiceWorkerUpdateReload(
  registration: ServiceWorkerRegistration,
) {
  let refreshing = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  if (registration.waiting) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;

    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        worker.postMessage({ type: "SKIP_WAITING" });
      }
    });
  });
}

async function generateAndSaveFCMToken(
  swRegistration: ServiceWorkerRegistration | null,
) {
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
  } catch {
    return;
  }
}

async function setupForegroundNotifications() {
  try {
    const { setupForegroundNotifications: setup } =
      await import("@/lib/firebase");
    await setup();
  } catch {
    return;
  }
}
