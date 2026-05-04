import * as admin from "firebase-admin";
import { initializeFirebaseAdmin } from "@/lib/firebaseAdmin";

export function getFirestore() {
  initializeFirebaseAdmin();
  return admin.firestore();
}

export function nowTimestamp() {
  return admin.firestore.Timestamp.now();
}

export function timestampToIso(value: unknown): string | null {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }

  return null;
}

export { admin };
