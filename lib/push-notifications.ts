"use client";

export const FCM_TOKEN_KEY = "fcm_token";
const NOTIFICATION_PREFERENCE_KEY = "notification_preference";

export type NotificationPreference = "enabled" | "disabled";
export type PushNotificationStatus =
  | "requesting-permission"
  | "registering-service-worker"
  | "initializing-firebase"
  | "requesting-fcm-token"
  | "saving-fcm-token"
  | "enabled";

interface EnablePushNotificationOptions {
  onStatus?: (status: PushNotificationStatus) => void;
}

export function getNotificationPreference(): NotificationPreference | null {
  const preference = localStorage.getItem(NOTIFICATION_PREFERENCE_KEY);
  return preference === "enabled" || preference === "disabled"
    ? preference
    : null;
}

export function setNotificationPreference(preference: NotificationPreference) {
  localStorage.setItem(NOTIFICATION_PREFERENCE_KEY, preference);
}

export async function enablePushNotifications(
  options: EnablePushNotificationOptions = {},
): Promise<string> {
  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    throw new Error("이 브라우저에서는 알림을 지원하지 않습니다.");
  }

  options.onStatus?.("requesting-permission");
  const permission = await requestNotificationPermission();
  if (permission !== "granted") {
    setNotificationPreference("disabled");
    throw new Error(
      permission === "denied"
        ? "브라우저에서 알림 권한이 차단되었습니다."
        : "브라우저 알림 권한이 허용되지 않았습니다.",
    );
  }

  options.onStatus?.("registering-service-worker");
  const swRegistration = await navigator.serviceWorker.register("/sw.js", {
    updateViaCache: "none",
  });
  await waitForServiceWorkerReady();

  options.onStatus?.("initializing-firebase");
  const { getToken, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) {
    throw new Error("이 브라우저에서는 Firebase 알림을 지원하지 않습니다.");
  }

  const { messaging, setupForegroundNotifications } =
    await import("@/lib/firebase");

  if (!messaging) {
    throw new Error("알림 서비스를 초기화하지 못했습니다.");
  }

  setupForegroundNotifications();

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    throw new Error("Firebase VAPID 키가 설정되지 않았습니다.");
  }

  options.onStatus?.("requesting-fcm-token");
  const token = await getToken(messaging, {
    serviceWorkerRegistration: swRegistration,
    vapidKey,
  });

  if (!token) {
    throw new Error("알림 토큰을 발급하지 못했습니다.");
  }

  options.onStatus?.("saving-fcm-token");
  const response = await fetch("/api/notifications/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fcm_token: token }),
  });

  if (!response.ok) {
    throw new Error("알림 토큰을 저장하지 못했습니다.");
  }

  localStorage.setItem(FCM_TOKEN_KEY, token);
  setNotificationPreference("enabled");
  options.onStatus?.("enabled");
  return token;
}

async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (Notification.permission !== "default") {
    return Notification.permission;
  }

  let timeoutId: number | undefined;

  try {
    return await Promise.race([
      Notification.requestPermission(),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(
            new Error(
              "브라우저가 알림 권한 요청창을 표시하지 않았습니다. 브라우저 설정에서 알림을 허용한 뒤 다시 시도해주세요.",
            ),
          );
        }, 10000);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
}

export async function disablePushNotifications(): Promise<void> {
  const storedToken = localStorage.getItem(FCM_TOKEN_KEY);
  let serverUnsubscribeFailed = false;

  // 사용자의 로컬 선택은 서버 상태와 무관하게 즉시 반영합니다.
  setNotificationPreference("disabled");

  if (storedToken) {
    try {
      const response = await fetch("/api/notifications/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fcm_token: storedToken }),
      });

      serverUnsubscribeFailed = !response.ok;
    } catch {
      serverUnsubscribeFailed = true;
    }
  }

  try {
    const { deleteToken } = await import("firebase/messaging");
    const { messaging } = await import("@/lib/firebase");

    if (messaging) {
      await deleteToken(messaging);
    }
  } catch {
    // 서버 해제 성공 여부와 관계없이 아래에서 로컬 활성 상태를 제거합니다.
  } finally {
    localStorage.removeItem(FCM_TOKEN_KEY);
    setNotificationPreference("disabled");
  }

  if (serverUnsubscribeFailed) {
    throw new Error("서버의 알림 토큰을 제거하지 못했습니다.");
  }
}

async function waitForServiceWorkerReady() {
  let timeoutId: number | undefined;

  try {
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(
            new Error(
              "알림 서비스 워커 준비 시간이 초과되었습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.",
            ),
          );
        }, 10000);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
}
