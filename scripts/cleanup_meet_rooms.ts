import * as admin from "firebase-admin";
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

async function cleanupMeetRooms() {
  try {
    const db = await initializeFirebase();
    const now = admin.firestore.Timestamp.now();

    console.log("\nFirestore meet_rooms 만료 문서 정리 시작\n");

    const snapshot = await db
      .collection("meet_rooms")
      .where("expires_at", "<=", now)
      .limit(100)
      .get();

    if (snapshot.empty) {
      console.log("정리할 일정 방이 없습니다.\n");
      return;
    }

    let deletedRooms = 0;
    let deletedParticipants = 0;

    for (const roomDoc of snapshot.docs) {
      const participantsDeleted = await deleteParticipants(db, roomDoc.ref);
      await roomDoc.ref.delete();

      deletedRooms++;
      deletedParticipants += participantsDeleted;
      console.log(
        `삭제 완료: ${roomDoc.id} (참여자 ${participantsDeleted}명)`,
      );
    }

    console.log(
      `\n정리 완료: 일정 방 ${deletedRooms}개, 참여자 문서 ${deletedParticipants}개 삭제\n`,
    );
  } catch (error) {
    console.error("일정 방 정리 실패:", error);
    process.exit(1);
  }
}

async function deleteParticipants(
  db: admin.firestore.Firestore,
  roomRef: admin.firestore.DocumentReference,
): Promise<number> {
  let deleted = 0;

  while (true) {
    const snapshot = await roomRef.collection("participants").limit(450).get();
    if (snapshot.empty) {
      return deleted;
    }

    const batch = db.batch();
    for (const participantDoc of snapshot.docs) {
      batch.delete(participantDoc.ref);
    }

    await batch.commit();
    deleted += snapshot.size;
  }
}

cleanupMeetRooms();
