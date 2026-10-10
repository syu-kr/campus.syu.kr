"use client";

import * as Sentry from "@sentry/nextjs";

export const FCM_TOKEN_KEY = "fcm_token";
const NOTIFICATION_PREFERENCE_KEY = "notification_preference";
const TOKEN_SYNC_KEY = "fcm_token_synced";
const TOKEN_RETRY_KEY = "fcm_token_retry";
const TOKEN_PENDING_KEY = "fcm_token_pending";
const DISABLED_REVISION_KEY = "notification_disabled_revision";
// Keep the server heartbeat below the cleanup job's minimum retention (7 days).
const TOKEN_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_RETRY_MS = 60 * 60 * 1000;

export type NotificationPreference = "enabled" | "disabled";
export type PushNotificationStatus =
  | "requesting-permission"
  | "registering-service-worker"
  | "initializing-firebase"
  | "requesting-fcm-token"
  | "saving-fcm-token"
  | "enabled";
export type SubscriptionRateLimitScope = "subscribe-ip" | "subscribe-token-ip";

interface EnablePushNotificationOptions {
  onStatus?: (status: PushNotificationStatus) => void;
  trigger?: "automatic" | "manual";
}

export class PushSubscriptionError extends Error {
  readonly code: "RATE_LIMITED" | "SUBSCRIBE_FAILED";

  constructor(
    readonly status: number,
    readonly retryAt?: number,
    readonly scope?: SubscriptionRateLimitScope,
    readonly fromCooldown = false,
  ) {
    super(
      status === 429
        ? "알림 요청이 많습니다. 잠시 후 다시 시도해주세요."
        : "알림 토큰을 저장하지 못했습니다.",
    );
    this.name = "PushSubscriptionError";
    this.code = status === 429 ? "RATE_LIMITED" : "SUBSCRIBE_FAILED";
  }
}

let operationQueue: Promise<unknown> = Promise.resolve();
let pendingEnable:
  | {
      trigger: "automatic" | "manual";
      disabledRevision: string | null;
      promise: Promise<string | null>;
    }
  | undefined;

function serializePushOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(() => {
    if (navigator.locks?.request) {
      return navigator.locks.request("syu-push-notifications", operation);
    }
    // ponytail: without Web Locks, serialization is limited to this tab.
    return operation();
  });
  operationQueue = result.catch(() => {});
  return result;
}

export function getNotificationPreference(): NotificationPreference | null {
  const preference = localStorage.getItem(NOTIFICATION_PREFERENCE_KEY);
  return preference === "enabled" || preference === "disabled"
    ? preference
    : null;
}

export function setNotificationPreference(preference: NotificationPreference) {
  localStorage.setItem(NOTIFICATION_PREFERENCE_KEY, preference);
  if (preference === "disabled") {
    localStorage.setItem(DISABLED_REVISION_KEY, crypto.randomUUID());
  }
}

export function enablePushNotifications(
  options: EnablePushNotificationOptions = {},
): Promise<string | null> {
  const trigger = options.trigger ?? "manual";
  const disabledRevision = localStorage.getItem(DISABLED_REVISION_KEY);
  if (
    pendingEnable?.trigger === trigger &&
    pendingEnable.disabledRevision === disabledRevision
  ) {
    return pendingEnable.promise.then((token) => {
      if (token) options.onStatus?.("enabled");
      return token;
    });
  }

  // Start the browser prompt in the user's click, before waiting for a lock.
  const permissionRequest =
    trigger === "manual" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    Notification.permission === "default"
      ? requestNotificationPermission()
      : undefined;
  // A lock can outlive the permission timeout; consume rejection until it is awaited.
  void permissionRequest?.catch(() => {});
  const promise = serializePushOperation(() =>
    registerPushNotifications(
      options, trigger, disabledRevision, permissionRequest,
    ),
  );
  pendingEnable = { trigger, disabledRevision, promise };
  const clearPending = () => {
    if (pendingEnable?.promise === promise) pendingEnable = undefined;
  };
  void promise.then(clearPending, clearPending);
  return promise;
}

async function registerPushNotifications(
  options: EnablePushNotificationOptions,
  trigger: "automatic" | "manual",
  disabledRevision: string | null,
  permissionRequest?: Promise<NotificationPermission>,
): Promise<string | null> {
  const cancelled = () =>
    disabledRevision !== localStorage.getItem(DISABLED_REVISION_KEY) ||
    (trigger === "automatic" &&
      (getNotificationPreference() === "disabled" ||
        !("Notification" in window) ||
        Notification.permission !== "granted"));
  if (cancelled()) return null;

  let currentStatus: PushNotificationStatus = "requesting-permission";
  const updateStatus = (status: PushNotificationStatus) => {
    currentStatus = status;
    options.onStatus?.(status);
  };

  try {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      throw new Error("이 브라우저에서는 알림을 지원하지 않습니다.");
    }

    updateStatus("requesting-permission");
    const permission = await (permissionRequest ?? requestNotificationPermission());
    if (cancelled()) return null;
    if (permission !== "granted") {
      setNotificationPreference("disabled");
      throw new Error(
        permission === "denied"
          ? "브라우저에서 알림 권한이 차단되었습니다."
          : "브라우저 알림 권한이 허용되지 않았습니다.",
      );
    }

    updateStatus("registering-service-worker");
    const swRegistration = await withPushTimeout(
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }),
      "알림 서비스 워커 준비 시간이 초과되었습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.",
    );
    await waitForServiceWorkerReady();

    updateStatus("initializing-firebase");
    const { getToken, isSupported } = await withPushTimeout(
      import("firebase/messaging"),
      "알림 서비스를 초기화하지 못했습니다.",
    );
    if (
      !(await withPushTimeout(isSupported(), "알림 서비스를 초기화하지 못했습니다."))
    ) {
      throw new Error("이 브라우저에서는 Firebase 알림을 지원하지 않습니다.");
    }

    const { messaging, setupForegroundNotifications } = await withPushTimeout(
      import("@/lib/firebase"),
      "알림 서비스를 초기화하지 못했습니다.",
    );

    if (!messaging) {
      throw new Error("알림 서비스를 초기화하지 못했습니다.");
    }

    setupForegroundNotifications();

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      throw new Error("Firebase VAPID 키가 설정되지 않았습니다.");
    }

    updateStatus("requesting-fcm-token");
    const token = await withPushTimeout(
      getToken(messaging, { serviceWorkerRegistration: swRegistration, vapidKey }),
      "알림 토큰을 발급하지 못했습니다.",
    );

    if (!token) {
      throw new Error("알림 토큰을 발급하지 못했습니다.");
    }
    if (Notification.permission !== "granted") {
      setNotificationPreference("disabled");
      await unregisterPushNotifications();
      return null;
    }
    if (cancelled()) return null;

    const now = Date.now();
    const synced = readStoredObject(TOKEN_SYNC_KEY);
    const recentlySynced =
      synced.token === token &&
      localStorage.getItem(FCM_TOKEN_KEY) === token &&
      typeof synced.savedAt === "number" &&
      Number.isFinite(synced.savedAt) &&
      synced.savedAt > 0 &&
      synced.savedAt <= now &&
      now - synced.savedAt < TOKEN_SYNC_INTERVAL_MS;

    if (!recentlySynced) {
      updateStatus("saving-fcm-token");
      checkSubscriptionCooldown(token);

      // Keep an uncertain write available to opt-out without marking it subscribed.
      const previousPendingToken = localStorage.getItem(TOKEN_PENDING_KEY);
      localStorage.setItem(TOKEN_PENDING_KEY, token);
      let response: Response;
      let hasUncertainWrite = false;
      try {
        response = await requestPushSubscription("POST", token);
      } catch (error) {
        if (
          trigger !== "automatic" ||
          !(error instanceof TypeError) ||
          !navigator.onLine ||
          document.visibilityState !== "visible"
        ) {
          throw error;
        }
        hasUncertainWrite = true;
        await new Promise((resolve) => window.setTimeout(resolve, 5000));
        if ("Notification" in window && Notification.permission !== "granted") {
          setNotificationPreference("disabled");
          await unregisterPushNotifications();
          return null;
        }
        if (cancelled()) return null;
        if (!navigator.onLine || document.visibilityState !== "visible") throw error;
        checkSubscriptionCooldown(token);
        response = await requestPushSubscription("POST", token);
      }

      if (!response.ok) {
        // A rejected retry does not rule out the earlier POST having reached the server.
        if (response.status >= 400 && response.status < 500 && !hasUncertainWrite) {
          if (previousPendingToken) {
            localStorage.setItem(TOKEN_PENDING_KEY, previousPendingToken);
          } else {
            localStorage.removeItem(TOKEN_PENDING_KEY);
          }
        }
        if (response.status === 429) {
          const scope =
            response.headers.get("X-RateLimit-Scope") === "subscribe-ip"
              ? "subscribe-ip"
              : "subscribe-token-ip";
          const retryAt = readRetryAt(response);
          localStorage.setItem(
            TOKEN_RETRY_KEY,
            JSON.stringify({ token, scope, retryAt }),
          );
          throw new PushSubscriptionError(429, retryAt, scope);
        }
        throw new PushSubscriptionError(response.status);
      }

      // An already-sent POST must leave its token for the queued opt-out to delete.
      localStorage.setItem(FCM_TOKEN_KEY, token);
      localStorage.removeItem(TOKEN_PENDING_KEY);
      if (Notification.permission !== "granted") {
        setNotificationPreference("disabled");
        await unregisterPushNotifications();
        return null;
      }
      if (cancelled()) return null;
      localStorage.setItem(
        TOKEN_SYNC_KEY,
        JSON.stringify({ token, savedAt: Date.now() }),
      );
      localStorage.removeItem(TOKEN_RETRY_KEY);
    }

    setNotificationPreference("enabled");
    updateStatus("enabled");
    return token;
  } catch (error) {
    if (!(error instanceof PushSubscriptionError && error.fromCooldown)) {
      const errorCode = readErrorCode(error);
      Sentry.captureException(error, {
        tags: {
          feature: "push-notifications",
          step: currentStatus,
          trigger,
          permission:
            "Notification" in window ? Notification.permission : "unsupported",
          ...(error instanceof PushSubscriptionError
            ? {
                http_status: String(error.status),
                error_code: error.code,
                ...(error.scope ? { rate_limit_scope: error.scope } : {}),
              }
            : errorCode
              ? { firebase_error_code: errorCode }
              : {}),
        },
      });
    }
    throw error;
  }
}

function checkSubscriptionCooldown(token: string) {
  const now = Date.now();
  const retry = readStoredObject(TOKEN_RETRY_KEY);
  if (
    (retry.scope === "subscribe-ip" || retry.token === token) &&
    typeof retry.retryAt === "number" &&
    Number.isFinite(retry.retryAt) &&
    retry.retryAt > now &&
    retry.retryAt <= now + MAX_RETRY_MS
  ) {
    throw new PushSubscriptionError(
      429,
      retry.retryAt,
      retry.scope === "subscribe-ip" ? "subscribe-ip" : "subscribe-token-ip",
      true,
    );
  }
}

function readStoredObject(key: string): Record<string, unknown> {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function readRetryAt(response: Response): number {
  const now = Date.now();
  const header = response.headers.get("Retry-After")?.trim();
  const delay = header
    ? /^\d+$/.test(header)
      ? Number(header) * 1000
      : Date.parse(header) - now
    : NaN;
  return (
    now +
    Math.min(
      MAX_RETRY_MS,
      Number.isFinite(delay) && delay >= 0 ? Math.max(1000, delay) : 60000,
    )
  );
}

function readErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (Notification.permission !== "default") return Notification.permission;
  return withPushTimeout(
    Notification.requestPermission(),
    "브라우저가 알림 권한 요청창을 표시하지 않았습니다. 브라우저 설정에서 알림을 허용한 뒤 다시 시도해주세요.",
  );
}

export function disablePushNotifications(): Promise<void> {
  pendingEnable = undefined;
  // Reflect opt-out immediately; the same queue/lock orders server and SDK changes.
  setNotificationPreference("disabled");
  return serializePushOperation(unregisterPushNotifications);
}

async function unregisterPushNotifications(): Promise<void> {
  const tokens = new Set([
    localStorage.getItem(FCM_TOKEN_KEY),
    localStorage.getItem(TOKEN_PENDING_KEY),
  ]);
  let serverUnsubscribeFailed = false;

  for (const token of tokens) {
    if (!token) continue;
    try {
      const response = await requestPushSubscription("DELETE", token);
      if (!response.ok) serverUnsubscribeFailed = true;
    } catch {
      serverUnsubscribeFailed = true;
    }
  }

  try {
    const { deleteToken } = await withPushTimeout(
      import("firebase/messaging"),
      "알림 서비스를 초기화하지 못했습니다.",
    );
    const { messaging } = await withPushTimeout(
      import("@/lib/firebase"),
      "알림 서비스를 초기화하지 못했습니다.",
    );

    if (messaging) {
      await withPushTimeout(
        deleteToken(messaging),
        "서버의 알림 토큰을 제거하지 못했습니다.",
      );
    }
  } catch {
    // Always clear local activation even if the server or Firebase cannot respond.
  } finally {
    localStorage.removeItem(FCM_TOKEN_KEY);
    localStorage.removeItem(TOKEN_SYNC_KEY);
    localStorage.removeItem(TOKEN_RETRY_KEY);
    localStorage.removeItem(TOKEN_PENDING_KEY);
    // Preserve the opt-out revision so a later explicit opt-in can run next.
    localStorage.setItem(NOTIFICATION_PREFERENCE_KEY, "disabled");
  }

  if (serverUnsubscribeFailed) {
    throw new Error("서버의 알림 토큰을 제거하지 못했습니다.");
  }
}

async function waitForServiceWorkerReady() {
  return withPushTimeout(
    navigator.serviceWorker.ready,
    "알림 서비스 워커 준비 시간이 초과되었습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.",
  );
}

async function requestPushSubscription(method: "POST" | "DELETE", token: string) {
  const controller = new AbortController();
  return withPushTimeout(
    fetch("/api/notifications/subscribe", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fcm_token: token }),
      signal: controller.signal,
    }),
    "알림 서버 응답 시간이 초과되었습니다.",
    () => controller.abort(),
  );
}

async function withPushTimeout<T>(
  operation: Promise<T>,
  message: string,
  onTimeout?: () => void,
): Promise<T> {
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error(message));
          onTimeout?.();
        }, 10000);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}
