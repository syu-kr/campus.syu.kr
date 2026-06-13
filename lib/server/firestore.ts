import {
  FieldPath,
  FieldValue,
  Timestamp,
  getFirestore as getAdminFirestore,
} from "firebase-admin/firestore";
import { initializeFirebaseAdmin } from "@/lib/firebaseAdmin";

export function getFirestore() {
  initializeFirebaseAdmin();
  return getAdminFirestore();
}

export function nowTimestamp() {
  return Timestamp.now();
}

export function timestampToIso(value: unknown): string | null {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  return null;
}

// Compatibility facade for existing server routes during the modular API migration.
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace admin {
  export const firestore = Object.assign(getFirestore, {
    FieldPath,
    FieldValue,
    Timestamp,
  });

  // eslint-disable-next-line @typescript-eslint/no-namespace
  export namespace firestore {
    export type DocumentData = import("firebase-admin/firestore").DocumentData;
    export type DocumentReference =
      import("firebase-admin/firestore").DocumentReference;
    export type Firestore = import("firebase-admin/firestore").Firestore;
    export type QueryDocumentSnapshot<
      AppModelType = DocumentData,
      DbModelType extends DocumentData = DocumentData,
    > = import("firebase-admin/firestore").QueryDocumentSnapshot<
      AppModelType,
      DbModelType
    >;
  }
}
