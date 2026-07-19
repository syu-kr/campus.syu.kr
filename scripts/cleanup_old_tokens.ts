// scripts/cleanup_old_tokens.ts
// Firestore에서 오래된 비활성 FCM 토큰 삭제

import { admin, initializeScriptFirestore } from "./firebase-admin";

async function cleanupOldTokens() {
  try {
    const db = await initializeScriptFirestore();
    const cutoffDays = readCutoffDays(process.env.TOKEN_CLEANUP_DAYS);
    const cutoff = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - cutoffDays * 86400000),
    );

    console.log("\nFirestore user_devices 오래된 토큰 정리 시작\n");

    let deleted = 0;
    while (true) {
      const snapshot = await db
        .collection("user_devices")
        .where("last_updated", "<=", cutoff)
        .limit(450)
        .get();

      if (snapshot.empty) {
        break;
      }

      const batch = db.batch();
      snapshot.docs.forEach((doc, index) => {
        console.log(
          `[${deleted + index + 1}] 삭제 예정: ${doc.id}`,
        );
        batch.delete(doc.ref);
      });

      await batch.commit();
      deleted += snapshot.size;
    }

    if (deleted === 0) {
      console.log(`${cutoffDays}일 이상 갱신되지 않은 토큰이 없습니다.\n`);
      return;
    }

    console.log(`\n${deleted}개의 오래된 토큰 삭제 완료\n`);
    console.log(
      "사용자가 앱을 다시 방문하면 새 토큰이 자동으로 저장됩니다.\n",
    );
  } catch (error) {
    console.error("토큰 정리 실패:", error);
    process.exit(1);
  }
}

function readCutoffDays(value: string | undefined) {
  const days = Number(value || 90);
  if (!Number.isInteger(days) || days < 7 || days > 3650) {
    throw new Error("TOKEN_CLEANUP_DAYS는 7~3650 사이의 정수여야 합니다.");
  }
  return days;
}

cleanupOldTokens();
