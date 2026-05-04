import * as admin from "firebase-admin";
import { initializeScriptFirestore } from "./firebase-admin";

async function cleanupMeetRooms() {
  try {
    const db = await initializeScriptFirestore();
    const now = admin.firestore.Timestamp.now();

    console.log("\nFirestore meet_rooms 만료 문서 정리 시작\n");

    let deletedRooms = 0;
    let deletedParticipants = 0;

    while (true) {
      const snapshot = await db
        .collection("meet_rooms")
        .where("expires_at", "<=", now)
        .limit(100)
        .get();

      if (snapshot.empty) {
        break;
      }

      for (const roomDoc of snapshot.docs) {
        const participantsDeleted = await deleteParticipants(db, roomDoc.ref);
        await roomDoc.ref.delete();

        deletedRooms++;
        deletedParticipants += participantsDeleted;
        console.log(
          `삭제 완료: ${roomDoc.id} (참여자 ${participantsDeleted}명)`,
        );
      }
    }

    if (deletedRooms === 0) {
      console.log("정리할 일정 방이 없습니다.\n");
      return;
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
