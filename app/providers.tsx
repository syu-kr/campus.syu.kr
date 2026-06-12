"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect } from "react";
import { NotificationModal } from "@/components/NotificationModal";
import { NotificationPermissionPrompt } from "@/components/NotificationPermissionPrompt";
import {
  FCM_TOKEN_KEY,
  enablePushNotifications,
  getNotificationPreference,
} from "@/lib/push-notifications";

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
      <NotificationPermissionPrompt />
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

  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    return;
  }

  const permission = Notification.permission;
  const preference = getNotificationPreference();
  const storedToken = localStorage.getItem(FCM_TOKEN_KEY);

  if (
    permission !== "granted" ||
    preference === "disabled" ||
    (!preference && !storedToken)
  ) {
    return;
  }

  try {
    await enablePushNotifications();
  } catch {
    return;
  }
}
