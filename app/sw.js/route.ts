import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FIREBASE_COMPAT_VERSION = "12.11.0";

export async function GET() {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const missingKeys = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    console.error(
      `[Service Worker] Missing Firebase config: ${missingKeys.join(", ")}`,
    );
    return new NextResponse(
      'console.error("Firebase service worker config is incomplete");',
      {
        status: 503,
        headers: serviceWorkerHeaders(),
      },
    );
  }

  const source = `
const FIREBASE_COMPAT_VERSION = ${JSON.stringify(FIREBASE_COMPAT_VERSION)};

importScripts(
  \`https://www.gstatic.com/firebasejs/\${FIREBASE_COMPAT_VERSION}/firebase-app-compat.js\`,
);
importScripts(
  \`https://www.gstatic.com/firebasejs/\${FIREBASE_COMPAT_VERSION}/firebase-messaging-compat.js\`,
);

firebase.initializeApp(${JSON.stringify(firebaseConfig)});
firebase.messaging();

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const requestedUrl = event.notification.data?.url || "/";
  const targetUrl = new URL(requestedUrl, self.location.origin);
  const urlToOpen =
    targetUrl.origin === self.location.origin ? targetUrl.href : self.location.origin;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === urlToOpen && "focus" in client) {
            return client.focus();
          }
        }
        return clients.openWindow?.(urlToOpen);
      }),
  );
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName))),
      )
      .then(() => self.clients.claim()),
  );
});
`;

  return new NextResponse(source, {
    headers: serviceWorkerHeaders(),
  });
}

function serviceWorkerHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Content-Type": "application/javascript; charset=utf-8",
    "Service-Worker-Allowed": "/",
  };
}
