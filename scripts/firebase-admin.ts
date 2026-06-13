import { cert, getApps, initializeApp } from "firebase-admin/app";
import {
  FieldPath,
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";

function loadEnvLocal() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return;
  }

  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local 파일을 찾을 수 없습니다");
  }

  const envContent = fs.readFileSync(envPath, "utf-8");
  const startIdx = envContent.indexOf("FIREBASE_SERVICE_ACCOUNT=");
  if (startIdx === -1) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT를 찾을 수 없습니다");
  }

  let jsonStr = "";
  let braceCount = 0;
  let inJson = false;
  let charIdx = startIdx + "FIREBASE_SERVICE_ACCOUNT=".length;

  while (charIdx < envContent.length) {
    const char = envContent[charIdx];

    if (char === "{") {
      inJson = true;
      braceCount++;
    }

    if (inJson) {
      jsonStr += char;

      if (char === "}") {
        braceCount--;
        if (braceCount === 0) {
          break;
        }
      }
    }

    charIdx++;
  }

  if (!jsonStr) {
    throw new Error("유효한 Firebase 서비스 계정 JSON을 찾을 수 없습니다");
  }

  process.env.FIREBASE_SERVICE_ACCOUNT = jsonStr;

  const pidMatch = envContent.match(
    /NEXT_PUBLIC_FIREBASE_PROJECT_ID=(.+?)(?:\n|$)/,
  );
  if (pidMatch) {
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = pidMatch[1];
  }
}

export async function initializeScriptFirestore() {
  loadEnvLocal();

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT 환경 변수가 필요합니다");
  }

  const serviceAccount = JSON.parse(serviceAccountJson);

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
