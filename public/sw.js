// Service Worker - Firebase 푸시 알림 처리

// Firebase 메시징 라이브러리 import
// package.json의 firebase 버전과 맞춰 compat CDN 버전을 관리한다.
const FIREBASE_COMPAT_VERSION = "12.11.0";

importScripts(
  `https://www.gstatic.com/firebasejs/${FIREBASE_COMPAT_VERSION}/firebase-app-compat.js`,
);
importScripts(
  `https://www.gstatic.com/firebasejs/${FIREBASE_COMPAT_VERSION}/firebase-messaging-compat.js`,
);

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyBEXjKbfeCBSRYgc7kHZuapaVpxD4YNXPk",
  authDomain: "syu-campus.firebaseapp.com",
  projectId: "syu-campus",
  storageBucket: "syu-campus.firebasestorage.app",
  messagingSenderId: "246764269895",
  appId: "1:246764269895:web:ca165941a6348ee88f1c62",
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);

// Firebase Messaging 초기화
// notification payload는 백그라운드에서 Firebase가 자동으로 표시한다.
firebase.messaging();

// 알림 클릭 핸들러
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === urlToOpen && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      }),
  );
});

// 일반적인 SW 캐싱 로직
// 캐싱 로직 제거 - 모든 요청을 네트워크에서 처리

// 설치 이벤트
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// 활성화 이벤트
self.addEventListener("activate", (event) => {
  // 모든 기존 캐시 삭제
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName)),
      );
    }),
  );
  self.clients.claim();
});

// Fetch 이벤트 - 캐싱 전략 제거, 네트워크 우선만 사용
// Service Worker는 오직 Firebase 메시징만 담당하며 캐싱은 하지 않음
