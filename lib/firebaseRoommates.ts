"use client";

import { getApps, initializeApp } from "firebase/app";
import { getAuth, inMemoryPersistence, setPersistence, signOut, type Auth } from "firebase/auth";

let pendingAuth: Promise<Auth> | undefined;

/** A named app keeps temporary student sign-in separate from admin and push auth. */
export function getRoommateAuth(): Promise<Auth> {
  if (!pendingAuth) {
    pendingAuth = (async () => {
      const name = "syu-roommates";
      const app = getApps().find((item) => item.name === name) ?? initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      }, name);
      const auth = getAuth(app);
      await setPersistence(auth, inMemoryPersistence);
      return auth;
    })();
    pendingAuth.catch(() => { pendingAuth = undefined; });
  }
  return pendingAuth;
}

export async function clearRoommateAuth() {
  if (pendingAuth) await signOut(await pendingAuth);
}
