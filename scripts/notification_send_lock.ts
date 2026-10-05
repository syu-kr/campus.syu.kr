import { createHash } from "crypto";
import { admin, initializeScriptFirestore } from "./firebase-admin";

const DELETE_FAILED_FLAG = "--delete-failed";
const DELETE_STALE_SENDING_FLAG = "--delete-stale-sending";
const MAX_SENDING_AGE_MINUTES = 30;

export async function runNotificationSendLock(args = process.argv.slice(2)) {
  const dedupeKey = args.find((arg) => !arg.startsWith("--"));
  const shouldDeleteFailed = args.includes(DELETE_FAILED_FLAG);
  const shouldDeleteStaleSending = args.includes(DELETE_STALE_SENDING_FLAG);

  if (!dedupeKey) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const db = await initializeScriptFirestore();
  const ref = db
    .collection("notification_send_locks")
    .doc(hashDedupeKey(dedupeKey));
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    console.log(`No notification send lock found for dedupeKey: ${dedupeKey}`);
    return;
  }

  const data = snapshot.data() || {};
  const status = String(data.status || "unknown");
  printLock(dedupeKey, status, data);

  if (shouldDeleteFailed || shouldDeleteStaleSending) {
    const deleted = await db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(ref);
      if (!currentSnapshot.exists) return false;

      const currentData = currentSnapshot.data() || {};
      const currentStatus = String(currentData.status || "unknown");
      const requiredStatus = shouldDeleteFailed ? "failed" : "sending";
      const flag = shouldDeleteFailed
        ? DELETE_FAILED_FLAG
        : DELETE_STALE_SENDING_FLAG;
      if (currentStatus !== requiredStatus) {
        throw new Error(
          `${flag} only deletes locks with status=${requiredStatus}. Current status: ${currentStatus}`,
        );
      }

      if (shouldDeleteStaleSending && !shouldDeleteFailed) {
        const updatedAt = readTimestampMs(
          currentData.updated_at ?? currentData.created_at,
        );
        const now = Date.now();
        if (
          updatedAt === null ||
          !Number.isFinite(updatedAt) ||
          updatedAt > now
        ) {
          throw new Error(
            "Refusing to delete a sending lock with an unknown, invalid, or future timestamp. Inspect manually.",
          );
        }

        const ageMinutes = Math.floor((now - updatedAt) / 60000);
        if (ageMinutes < MAX_SENDING_AGE_MINUTES) {
          throw new Error(
            `Refusing to delete a recent sending lock (${ageMinutes}m old). Wait at least ${MAX_SENDING_AGE_MINUTES}m or inspect manually.`,
          );
        }
      }

      transaction.delete(ref);
      return true;
    });
    console.log(
      deleted
        ? `Deleted ${shouldDeleteFailed ? "failed" : "stale sending"} notification send lock.`
        : "The notification send lock no longer exists. No mutation was performed.",
    );
    return;
  }

  console.log(
    [
      "",
      "No mutation was performed.",
      `Use ${DELETE_FAILED_FLAG} only after confirming the failed send can be retried safely.`,
      `Use ${DELETE_STALE_SENDING_FLAG} only when a sending lock is stale and no job is still running.`,
    ].join("\n"),
  );
}

function printUsage() {
  console.log(
    [
      "Usage:",
      "  npm run notification-lock -- <dedupeKey>",
      `  npm run notification-lock -- <dedupeKey> ${DELETE_FAILED_FLAG}`,
      `  npm run notification-lock -- <dedupeKey> ${DELETE_STALE_SENDING_FLAG}`,
    ].join("\n"),
  );
}

function printLock(
  dedupeKey: string,
  status: string,
  data: admin.firestore.DocumentData,
) {
  const createdAt = formatTimestamp(data.created_at);
  const updatedAt = formatTimestamp(data.updated_at);
  const sentAt = formatTimestamp(data.sent_at);
  const failedAt = formatTimestamp(data.failed_at);

  console.log(
    JSON.stringify(
      {
        dedupeKey,
        status,
        createdAt,
        updatedAt,
        sentAt,
        failedAt,
        error: typeof data.error === "string" ? data.error : undefined,
        notificationSentId:
          typeof data.notification_sent_id === "string"
            ? data.notification_sent_id
            : undefined,
      },
      null,
      2,
    ),
  );
}

function hashDedupeKey(dedupeKey: string) {
  return createHash("sha256").update(dedupeKey).digest("hex");
}

function formatTimestamp(value: unknown): string | null {
  const millis = readTimestampMs(value);
  return millis ? new Date(millis).toISOString() : null;
}

function readTimestampMs(value: unknown): number | null {
  return value instanceof admin.firestore.Timestamp ? value.toMillis() : null;
}

if (typeof require !== "undefined" && require.main === module) {
  runNotificationSendLock().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
