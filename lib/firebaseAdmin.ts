// lib/firebaseAdmin.ts
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
export function getMessagingInstance(): admin.messaging.Messaging {
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

  // 각 토큰에 개별 발송
  for (const token of tokens) {
    try {
      await messaging.send({
        token,
        notification: {
          title,
          body,
        },
        webpush: {
          notification: {
            title,
            body,
            icon: "/icon-192x192.png",
            badge: "/badge-72x72.png",
          },
          data: data || {},
        },
      });
      successCount++;
    } catch {
      failureCount++;
    }
  }

  return { successCount, failureCount };
}
