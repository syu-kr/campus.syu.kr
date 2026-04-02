// lib/firebaseAdmin.ts
// 서버 사이드 Firebase Admin SDK 초기화

import * as admin from "firebase-admin";

export function initializeFirebaseAdmin() {
  // 이미 초기화된 앱이 있으면 기존 앱 사용
  if (admin.apps.length > 0) {
    return admin.app();
  }

  try {
    // 환경 변수에서 서비스 계정 JSON 읽기
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!serviceAccountJson) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT 환경변수가 설정되지 않았습니다",
      );
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    return app;
  } catch (error) {
    throw error;
  }
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
  try {
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error: unknown) {
        failureCount++;
      }
    }

    return { successCount, failureCount };
  } catch (error) {
    throw error;
  }
}
