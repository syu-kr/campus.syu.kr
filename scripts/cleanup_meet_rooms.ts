import { admin, initializeScriptFirestore } from "./firebase-admin";

const QUERY_LIMIT = 100;

async function cleanupExpiredFirestoreDocuments() {
  try {
    const db = await initializeScriptFirestore();
    const now = admin.firestore.Timestamp.now();

    console.log("\nFirestore 만료 문서 정리 시작\n");

    const meetResult = await cleanupMeetRooms(db, now);
    const deletedTimetableShares = await deleteExpiredDocuments(
      db,
      "timetable_shares",
      now,
    );
    const deletedRateLimits = await deleteExpiredDocuments(
      db,
      "api_rate_limits",
      now,
    );
    const deletedNotificationLocks = await deleteExpiredDocuments(
      db,
      "notification_send_locks",
      now,
    );

    console.log(
      [
        "\n정리 완료:",
        `일정 방 ${meetResult.rooms}개`,
        `참여자 문서 ${meetResult.participants}개`,
        `공유 시간표 ${deletedTimetableShares}개`,
        `API 요청 제한 문서 ${deletedRateLimits}개`,
        `알림 중복 방지 잠금 ${deletedNotificationLocks}개 삭제\n`,
      ].join(" "),
    );
  } catch (error) {
    console.error("Firestore 만료 문서 정리 실패:", error);
    process.exit(1);
  }
}

async function cleanupMeetRooms(
  db: admin.firestore.Firestore,
  now: admin.firestore.Timestamp,
) {
  let deletedRooms = 0;
  let deletedParticipants = 0;

  while (true) {
    const snapshot = await db
      .collection("meet_rooms")
      .where("expires_at", "<=", now)
      .limit(QUERY_LIMIT)
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
        `일정 방 삭제: ${roomDoc.id} (참여자 ${participantsDeleted}명)`,
      );
    }
  }

  return {
    rooms: deletedRooms,
    participants: deletedParticipants,
  };
}

async function deleteExpiredDocuments(
  db: admin.firestore.Firestore,
  collectionName: string,
  now: admin.firestore.Timestamp,
): Promise<number> {
  let deleted = 0;

  while (true) {
    const snapshot = await db
      .collection(collectionName)
      .where("expires_at", "<=", now)
      .limit(QUERY_LIMIT)
      .get();

    if (snapshot.empty) {
      return deleted;
    }

    const batch = db.batch();
    for (const document of snapshot.docs) {
      batch.delete(document.ref);
    }

    await batch.commit();
    deleted += snapshot.size;
    console.log(`${collectionName}: ${snapshot.size}개 삭제`);
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

cleanupExpiredFirestoreDocuments();
