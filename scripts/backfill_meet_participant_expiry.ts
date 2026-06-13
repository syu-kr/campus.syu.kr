import { admin, initializeScriptFirestore } from "./firebase-admin";

const PAGE_SIZE = 100;
const BATCH_SIZE = 450;

async function backfillMeetParticipantExpiry() {
  const db = await initializeScriptFirestore();
  let lastRoom:
    | admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>
    | undefined;
  let updatedParticipants = 0;
  let skippedRooms = 0;

  console.log("\nFirestore 일정 참여자 expires_at 보정 시작\n");

  while (true) {
    let query = db
      .collection("meet_rooms")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(PAGE_SIZE);

    if (lastRoom) {
      query = query.startAfter(lastRoom);
    }

    const rooms = await query.get();
    if (rooms.empty) break;

    for (const room of rooms.docs) {
      const expiresAt = room.get("expires_at");

      if (!(expiresAt instanceof admin.firestore.Timestamp)) {
        skippedRooms++;
        console.warn(`건너뜀: ${room.id} 문서에 유효한 expires_at이 없습니다.`);
        continue;
      }

      updatedParticipants += await updateParticipants(room.ref, expiresAt);
    }

    lastRoom = rooms.docs.at(-1);
  }

  console.log(
    `\n보정 완료: 참여자 ${updatedParticipants}개 업데이트, 방 ${skippedRooms}개 건너뜀\n`,
  );
}

async function updateParticipants(
  roomRef: admin.firestore.DocumentReference,
  expiresAt: admin.firestore.Timestamp,
) {
  let lastParticipant:
    | admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>
    | undefined;
  let updated = 0;

  while (true) {
    let query = roomRef
      .collection("participants")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(BATCH_SIZE);

    if (lastParticipant) {
      query = query.startAfter(lastParticipant);
    }

    const participants = await query.get();
    if (participants.empty) return updated;

    const batch = roomRef.firestore.batch();
    for (const participant of participants.docs) {
      batch.update(participant.ref, { expires_at: expiresAt });
    }
    await batch.commit();

    updated += participants.size;
    lastParticipant = participants.docs.at(-1);
  }
}

backfillMeetParticipantExpiry().catch((error) => {
  console.error("일정 참여자 expires_at 보정 실패:", error);
  process.exit(1);
});
