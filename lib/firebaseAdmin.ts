// lib/firebaseAdmin.ts
// 서버 사이드 Firebase Admin SDK 초기화

import * as admin from "firebase-admin";

// Firebase Admin SDK 초기화 (한 번만 실행)
let app: admin.app.App | null = null;

export function initializeFirebaseAdmin() {
  if (app) return app;

  try {
    // 환경 변수에서 서비스 계정 JSON 읽기
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!serviceAccountJson) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT 환경변수가 설정되지 않았습니다",
      );
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log("✅ Firebase Admin 초기화 완료");
  } catch (error) {
    console.error("❌ Firebase Admin 초기화 실패:", error);
    throw error;
  }

  return app;
}

// Messaging 인스턴스 가져오기
export function getMessagingInstance(): admin.messaging.Messaging {
  if (!app) {
    initializeFirebaseAdmin();
  }
  return admin.messaging(app!);
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
        console.log(`✅ FCM 발송 성공 (${token.substring(0, 20)}...)`);
      } catch (error: any) {
        failureCount++;
        console.error(`❌ 토큰 발송 실패 (${token.substring(0, 20)}...):`, {
          code: error?.code,
          message: error?.message,
          details: error?.toString(),
        });
      }
    }

    console.log(`FCM 발송: ${successCount}명 성공, ${failureCount}명 실패`);

    return { successCount, failureCount };
  } catch (error) {
    console.error("FCM 메시지 발송 실패:", error);
    throw error;
  }
}
