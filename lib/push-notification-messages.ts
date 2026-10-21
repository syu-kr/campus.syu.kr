import type { Dictionary, Locale } from "@/lib/i18n";
import { PushSubscriptionError } from "@/lib/push-notifications";

type NotificationPrivacyDictionary = Dictionary["pages"]["notificationPrivacy"];

const pushErrorKeys: Record<string, keyof NotificationPrivacyDictionary["errors"]> = {
  "이 브라우저에서는 알림을 지원하지 않습니다.": "unsupported",
  "브라우저에서 알림 권한이 차단되었습니다.": "denied",
  "브라우저 알림 권한이 허용되지 않았습니다.": "notAllowed",
  "브라우저가 알림 권한 요청창을 표시하지 않았습니다. 브라우저 설정에서 알림을 허용한 뒤 다시 시도해주세요.":
    "permissionTimeout",
  "이 브라우저에서는 Firebase 알림을 지원하지 않습니다.": "firebaseUnsupported",
  "알림 서비스를 초기화하지 못했습니다.": "initFailed",
  "Firebase VAPID 키가 설정되지 않았습니다.": "vapidMissing",
  "알림 토큰을 발급하지 못했습니다.": "tokenFailed",
  "알림 토큰을 저장하지 못했습니다.": "saveFailed",
  "서버의 알림 토큰을 제거하지 못했습니다.": "deleteFailed",
  "알림 서비스 워커 준비 시간이 초과되었습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.":
    "workerTimeout",
  "알림 서버 응답 시간이 초과되었습니다.": "serverTimeout",
};

export function getPushErrorMessage(
  error: unknown,
  text: NotificationPrivacyDictionary,
  fallback: string,
  locale: Locale,
): string {
  if (error instanceof PushSubscriptionError && error.status === 429) {
    return text.rateLimited.replace(
      "{time}",
      new Date(error.retryAt ?? Date.now() + 60_000).toLocaleString(
        locale === "ko" ? "ko-KR" : "en-US",
      ),
    );
  }
  if (!(error instanceof Error)) return fallback;

  const key = pushErrorKeys[error.message];
  return key ? text.errors[key] : fallback;
}
