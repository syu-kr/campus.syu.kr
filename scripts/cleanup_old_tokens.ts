// scripts/cleanup_old_tokens.ts
// Firestore에서 모든 오래된 토큰 삭제

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

// 로컬 개발 환경에서 .env.local 파일 파싱
function loadEnvLocal() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return; // 이미 설정되어 있음 (GitHub Actions)
  }

  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local 파일을 찾을 수 없습니다");
  }

  const envContent = fs.readFileSync(envPath, "utf-8");

  // FIREBASE_SERVICE_ACCOUNT의 JSON 파싱
  const startIdx = envContent.indexOf("FIREBASE_SERVICE_ACCOUNT=");
  if (startIdx === -1) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT를 찾을 수 없습니다");
  }

  // '=' 다음부터 시작. JSON 객체를 찾아서 끝까지 파싱
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
    throw new Error("유효한 JSON을 찾을 수 없습니다");
  }

  process.env.FIREBASE_SERVICE_ACCOUNT = jsonStr;

  // PROJECT_ID도 파싱
  const pidMatch = envContent.match(
    /NEXT_PUBLIC_FIREBASE_PROJECT_ID=(.+?)(?:\n|$)/,
  );
  if (pidMatch) {
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = pidMatch[1];
  }
}

async function initializeFirebase() {
  loadEnvLocal();

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT 환경 변수가 필요합니다");
  }

  const serviceAccount = JSON.parse(serviceAccountJson);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }

  return admin.firestore();
}

async function cleanupOldTokens() {
  try {
    const db = await initializeFirebase();

    console.log("\n🗑️ Firestore user_devices 컬렉션 정리 시작\n");

    // 모든 문서 조회
    const snapshot = await db.collection("user_devices").get();

    console.log(`📊 현재 저장된 토큰: ${snapshot.size}개\n`);

    if (snapshot.size === 0) {
      console.log("✅ 정리할 토큰이 없습니다.\n");
      return;
    }

    // 배치 삭제 (500개까지 한 번에)
    let deleted = 0;
    const batch = db.batch();

    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(
        `[${index + 1}/${snapshot.size}] 삭제 예정: ${data.fcm_token?.substring(0, 30)}...`,
      );
      batch.delete(doc.ref);
    });

    await batch.commit();
    deleted = snapshot.size;

    console.log(`\n✅ ${deleted}개의 토큰 삭제 완료\n`);
    console.log(
      "📱 사용자들이 앱을 다시 방문하면 새로운 토큰이 자동으로 생성됩니다.\n",
    );
  } catch (error) {
    console.error("❌ 토큰 정리 실패:", error);
    process.exit(1);
  }
}

cleanupOldTokens();
