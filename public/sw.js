// public/sw.js
// Service Worker - Firebase 푸시 알림 처리

// Firebase 메시징 라이브러리 import
importScripts(
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js",
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

// Firebase Messaging 가져오기
const messaging = firebase.messaging();

// 백그라운드 메시지 핸들러
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || "/icon-192x192.png",
    badge: payload.notification.badge || "/badge-72x72.png",
    tag: payload.data?.tag || "notification",
    data: payload.data || {},
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

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
const CACHE_NAME = "syu-campus-cache";
// HTML은 캐시하지 않음 (네트워크 우선)
const urlsToCache = ["/manifest.json"];

// 설치 이벤트
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    }),
  );
  self.skipWaiting();
});

// 활성화 이벤트
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      );
    }),
  );
  self.clients.claim();
});

// Fetch 이벤트 (캐싱 전략)
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API 요청은 캐시 안 함
  if (url.pathname.includes("/api/")) {
    return;
  }

  // 공지사항 JSON은 항상 최신 데이터를 가져와야 함 - 캐시 안 함
  if (
    url.pathname.includes("/data/announcements-") ||
    url.pathname.includes("/data/announcements-campus-life")
  ) {
    return; // Network를 직접 사용 (캐싱 안함)
  }

  // GET 요청만 캐싱
  if (event.request.method !== "GET") {
    return;
  }

  // http/https 스키마만 캐싱 (chrome-extension 등 차단)
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // HTML 페이지: 네트워크 우선 전략 (항상 최신 버전 제공)
  const isHtml = url.pathname === "/" || url.pathname.endsWith(".html");

  if (isHtml) {
    // 네트워크 우선: 네트워크 요청 → 실패시 캐시
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }
          // 성공한 응답은 캐시 업데이트
          try {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache).catch(() => {});
            });
          } catch (error) {}
          return response;
        })
        .catch(() => {
          // 네트워크 실패시 캐시 사용
          return caches.match(event.request);
        }),
    );
  } else {
    // 비-HTML 리소스: 캐시 우선 전략 (JS, CSS, 이미지 등)
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200) {
              return response;
            }

            // 캐시 저장 시도
            try {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache).catch(() => {});
              });
            } catch (error) {}

            return response;
          })
          .catch(() => {
            return caches.match("/");
          });
      }),
    );
  }
});
