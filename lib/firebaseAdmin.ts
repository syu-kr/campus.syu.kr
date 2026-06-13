// 서버 사이드 Firebase Admin SDK 초기화

import * as admin from "firebase-admin";

export function initializeFirebaseAdmin() {
  // 이미 초기화된 앱이 있으면 기존 앱 사용
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!serviceAccountJson) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT 환경변수가 설정되지 않았습니다");
  }

  const serviceAccount = JSON.parse(serviceAccountJson);

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Messaging 인스턴스 가져오기
function getMessagingInstance(): admin.messaging.Messaging {
  if (admin.apps.length === 0) {
    initializeFirebaseAdmin();
  }
  return admin.messaging();
}

// FCM 메시지 발송
export async function sendFCMMessage(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  const messaging = getMessagingInstance();

  let successCount = 0;
  let failureCount = 0;
  const invalidTokens: string[] = [];

  for (let index = 0; index < tokens.length; index += 500) {
    const batchTokens = tokens.slice(index, index + 500);
    const response = await messaging.sendEachForMulticast({
      tokens: batchTokens,
      notification: {
        title,
        body,
      },
      webpush: {
        notification: {
          title,
          body,
          icon: "/images/syu-kr-logo.png",
          badge: "/images/syu-kr-logo.png",
        },
        data: data || {},
      },
    });

    successCount += response.successCount;
    failureCount += response.failureCount;
    response.responses.forEach((result, responseIndex) => {
      if (!result.success && isInvalidFcmTokenError(result.error?.code)) {
        invalidTokens.push(batchTokens[responseIndex]);
      }
    });
  }

  return { successCount, failureCount, invalidTokens };
}

function isInvalidFcmTokenError(code: string | undefined) {
  return (
    code === "messaging/invalid-registration-token" ||
    code === "messaging/registration-token-not-registered"
  );
}
