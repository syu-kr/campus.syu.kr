// lib/firebase.ts
// 클라이언트 사이드 Firebase 초기화

import { initializeApp } from "firebase/app";
import { getMessaging, onMessage, Messaging } from "firebase/messaging";
import { setNotificationHandler } from "@/components/NotificationModal";

const firebaseConfig = {
  apiKey: "AIzaSyBEXjKbfeCBSRYgc7kHZuapaVpxD4YNXPk",
  authDomain: "syu-campus.firebaseapp.com",
  projectId: "syu-campus",
  storageBucket: "syu-campus.firebasestorage.app",
  messagingSenderId: "246764269895",
  appId: "1:246764269895:web:ca165941a6348ee88f1c62",
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// 클라이언트에서만 Messaging 사용 가능
let messaging: Messaging | null = null;

// 브라우저 환경에서만 Messaging 초기화
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  try {
    messaging = getMessaging(app);
  } finally {
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
