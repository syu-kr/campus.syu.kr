import type { Firestore, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { admin, initializeScriptFirestore } from "./firebase-admin";

const COLLECTIONS = ["site_inquiries", "campus_tip_suggestions"] as const;
const FIELDS = ["contact", "user_agent"] as const;
const PAGE_SIZE = 100;

export async function cleanupSubmissionMetadata(db: Firestore, apply = false) {
  const totals = {
    scanned: 0,
    candidates: 0,
    contactFields: 0,
    nonemptyContacts: 0,
    userAgentFields: 0,
    updated: 0,
  };

  for (const collection of COLLECTIONS) {
    let cursor: QueryDocumentSnapshot | undefined;
    while (true) {
      let query = db.collection(collection)
        .where("status", "in", ["done", "rejected"])
        .orderBy(admin.firestore.FieldPath.documentId())
        .select("status", ...FIELDS)
        .limit(PAGE_SIZE);
      if (cursor) query = query.startAfter(cursor);
      const snapshot = await query.get();
      if (snapshot.empty) break;

      const batch = apply ? db.batch() : null;
      let candidates = 0;
      for (const document of snapshot.docs) {
        totals.scanned++;
        if (!["done", "rejected"].includes(document.get("status"))) continue;
        const data = document.data();
        const fields = FIELDS.filter((field) => Object.hasOwn(data, field));
        if (!fields.length) continue;
        candidates++;
        totals.candidates++;
        if (fields.includes("contact")) totals.contactFields++;
        if (typeof data.contact === "string" && data.contact.trim()) totals.nonemptyContacts++;
        if (fields.includes("user_agent")) totals.userAgentFields++;
        // A reopened or edited submission must abort this page instead of losing its metadata.
        batch?.update(document.ref, Object.fromEntries(fields.map((field) => [
          field, admin.firestore.FieldValue.delete(),
        ])), { lastUpdateTime: document.updateTime });
      }
      if (batch && candidates) {
        await batch.commit();
        totals.updated += candidates;
      }
      cursor = snapshot.docs.at(-1);
    }
  }

  return totals;
}

export function readCleanupApply(args: string[]) {
  if (!args.length || (args.length === 1 && args[0] === "--dry-run")) return false;
  if (args.length === 1 && args[0] === "--apply") return true;
  throw new Error("Use no option, --dry-run, or --apply.");
}

async function main() {
  const apply = readCleanupApply(process.argv.slice(2));
  const db = await initializeScriptFirestore();
  const totals = await cleanupSubmissionMetadata(db, apply);
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...totals }));
}

if (typeof require !== "undefined" && require.main === module) {
  main().catch(() => {
    console.error("Submission metadata cleanup failed. Earlier pages may have committed; review configuration and concurrent edits, then repeat the dry-run. No document identifiers or contents are printed.");
    process.exitCode = 1;
  });
}
