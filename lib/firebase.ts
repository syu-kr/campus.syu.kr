// lib/firebase.ts
// 클라이언트 사이드 Firebase 초기화

import { initializeApp } from "firebase/app";
import { getMessaging, onMessage, Messaging } from "firebase/messaging";
import { setNotificationHandler } from "@/components/NotificationModal";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebase 설정 검증
if (
  !firebaseConfig.apiKey ||
  !firebaseConfig.authDomain ||
  !firebaseConfig.projectId
) {
  console.error("[Firebase] 필수 환경변수가 설정되지 않았습니다:", {
    apiKey: !!firebaseConfig.apiKey,
    authDomain: !!firebaseConfig.authDomain,
    projectId: !!firebaseConfig.projectId,
    messagingSenderId: !!firebaseConfig.messagingSenderId,
  });
}

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// 클라이언트에서만 Messaging 사용 가능
let messaging: Messaging | null = null;

// 브라우저 환경에서만 Messaging 초기화
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  try {
    messaging = getMessaging(app);
    console.log("[Firebase] Messaging 초기화 완료");
  } catch (error) {
    console.error("[Firebase] Messaging 초기화 실패:", error);
    // Error handling - silently fail
  }
}

export { messaging };

// 포그라운드 메시지 핸들러 (앱이 열려있을 때)
export function setupForegroundNotifications() {
  if (!messaging) return;

  onMessage(messaging, (payload) => {
    if (payload.notification) {
      const notification = {
        title: payload.notification.title || "",
        body: payload.notification.body || "",
        icon: payload.notification.icon,
        url: payload.data?.url,
      };
      setNotificationHandler(notification);
    }
  });
}
