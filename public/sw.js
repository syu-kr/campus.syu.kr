/* Service Worker for PWA functionality */

const CACHE_VERSION = "v1";
const CACHE_NAME = `syu-campus-${CACHE_VERSION}`;

// 캐시할 기본 파일들
const URL_TO_CACHE = [
  "/",
  "/offline.html",
  "/images/icon-192x192.png",
  "/images/icon-512x512.png",
];

// 설치 이벤트
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching app shell");
      return cache.addAll(URL_TO_CACHE);
    }),
  );
  self.skipWaiting();
});

// 활성화 이벤트
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activating...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("[Service Worker] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

// Fetch 이벤트 - Network First 전략
self.addEventListener("fetch", (event) => {
  // API 요청은 네트워크 우선
  if (event.request.url.includes("/api/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 성공 응답만 캐시
          if (response.ok) {
            const cache = caches.open(CACHE_NAME);
            cache.then((c) => c.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          // 네트워크 실패시 캐시 사용
          return caches.match(event.request);
        }),
    );
  }
  // 정적 리소스는 캐시 우선
  else {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      }),
    );
  }
});

// 백그라운드 동기화 (선택사항)
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-announcements") {
    event.waitUntil(syncAnnouncements());
  }
});

async function syncAnnouncements() {
  try {
    const response = await fetch("/api/announcements");
    return response.json();
  } catch (error) {
    console.error("Sync failed:", error);
  }
}

// Push 알림 (선택사항)
self.addEventListener("push", (event) => {
  const options = {
    body: event.data ? event.data.text() : "New notification",
    icon: "/images/icon-192x192.png",
    badge: "/images/icon-96x96.png",
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification("삼육대 캠퍼스", options));
});

// 알림 클릭 처리
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // 이미 열려있는 창이 있으면 포커스
      for (let i = 0; i < clientList.length; i++) {
        if (clientList[i].url === "/" && "focus" in clientList[i]) {
          return clientList[i].focus();
        }
      }
      // 새 창 열기
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    }),
  );
});

console.log("[Service Worker] Loaded successfully");
