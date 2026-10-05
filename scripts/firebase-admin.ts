import { cert, getApps, initializeApp } from "firebase-admin/app";
import {
  FieldPath,
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";
import { parseEnv } from "node:util";

export function loadEnvLocal() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return;
  }

  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local 파일을 찾을 수 없습니다");
  }

  const values = parseEnv(fs.readFileSync(envPath, "utf-8")) as Record<string, string>;
  if (!values.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT를 찾을 수 없습니다");
  }
  try {
    JSON.parse(values.FIREBASE_SERVICE_ACCOUNT);
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT는 한 줄 JSON 또는 따옴표로 감싼 여러 줄 JSON이어야 합니다.",
    );
  }
  process.env.FIREBASE_SERVICE_ACCOUNT = values.FIREBASE_SERVICE_ACCOUNT;
  if (
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === undefined &&
    values.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== undefined
  ) {
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID =
      values.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  }
}

export async function initializeScriptFirestore() {
  loadEnvLocal();

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT 환경 변수가 필요합니다");
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT는 유효한 JSON이어야 합니다.");
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }

  return getFirestore();
}

// Compatibility facade for maintenance scripts during the modular API migration.
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
    export type Timestamp = import("firebase-admin/firestore").Timestamp;
  }
}
