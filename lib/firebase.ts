import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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

if (
  !firebaseConfig.apiKey ||
  !firebaseConfig.authDomain ||
  !firebaseConfig.projectId
) {
  throw new Error("Firebase client config is incomplete");
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let messaging: Messaging | null = null;
let foregroundListenerRegistered = false;

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  try {
    messaging = getMessaging(app);
  } catch {}
}

export { auth, messaging };

export function setupForegroundNotifications() {
  if (!messaging) return;

  if (foregroundListenerRegistered) {
    return;
  }

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

  foregroundListenerRegistered = true;
}
