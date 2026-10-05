import { FieldPath, Timestamp, type DocumentReference, type Firestore } from "firebase-admin/firestore";

const DAY_MS = 86_400_000;
type RoommateCleanupCollection = "roommate_posts" | "roommate_reports" | "roommate_owner_state";

// Reused owner IDs can change after the expiry query; re-read before deleting.
export async function deleteExpiredRoommateDocument(db: Firestore, ref: DocumentReference, collection: RoommateCleanupCollection, now: Timestamp) {
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return false;
    const data = snapshot.data()!;
    if (!(data.expires_at instanceof Timestamp) || data.expires_at.toMillis() > now.toMillis()) return false;
    if (collection === "roommate_owner_state") {
      if (!(data.updated_at instanceof Timestamp) || data.updated_at.toMillis() + 90 * DAY_MS > now.toMillis()) return false;
      if (data.hold_until instanceof Timestamp && data.hold_until.toMillis() > now.toMillis()) return false;
      if (typeof data.active_post_id === "string" && data.active_post_id) {
        const active = await transaction.get(db.collection("roommate_posts").doc(data.active_post_id));
        if (active.exists && active.get("status") === "recruiting" && active.get("recruit_until") instanceof Timestamp && active.get("recruit_until").toMillis() > now.toMillis()) return false;
      }
    }
    if (collection === "roommate_reports" && (data.status === "pending" || data.status === "reviewing")) {
      transaction.set(db.collection("admin_audit_logs").doc(), {
        action: "roommate_report_expired_unresolved",
        report_id: ref.id,
        post_id: typeof data.post_id === "string" ? data.post_id : null,
        previous_status: data.status,
        note: "미처리 상태에서 보존 종료",
        created_at: now,
        expires_at: Timestamp.fromMillis(now.toMillis() + 365 * DAY_MS),
      });
    }
    transaction.delete(ref);
    return true;
  });
}

export async function cleanupRoommateDocuments(db: Firestore, now: Timestamp) {
  const counts = { sessions: 0, posts: 0, reports: 0, owners: 0 };
  const collections = ["roommate_posts", "roommate_reports", "roommate_owner_state"] as const;
  for (const collection of collections) {
    let cursor: { expiry: Timestamp; id: string } | null = null;
    while (true) {
      let query = db.collection(collection).where("expires_at", "<=", now).orderBy("expires_at", "asc").orderBy(FieldPath.documentId(), "asc");
      if (cursor) query = query.startAfter(cursor.expiry, cursor.id);
      const snapshot = await query.limit(100).get();
      if (snapshot.empty) break;
      for (const doc of snapshot.docs) {
        if (await deleteExpiredRoommateDocument(db, doc.ref, collection, now)) {
          if (collection === "roommate_posts") counts.posts++;
          if (collection === "roommate_reports") counts.reports++;
          if (collection === "roommate_owner_state") counts.owners++;
        }
      }
      const last = snapshot.docs.at(-1)!;
      cursor = { expiry: last.get("expires_at"), id: last.id };
      if (snapshot.size < 100) break;
    }
  }
  while (true) {
    const snapshot = await db.collection("roommate_sessions").where("expires_at", "<=", now).limit(100).get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    counts.sessions += snapshot.size;
  }
  return counts;
}
