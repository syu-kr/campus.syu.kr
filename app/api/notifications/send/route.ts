// 푸시 알림 발송 API (크롤러에서 호출)

import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import { initializeFirebaseAdmin } from "@/lib/firebaseAdmin";
import { sendFCMMessage } from "@/lib/firebaseMessaging";
import { admin } from "@/lib/server/firestore";
import { ApiError, apiErrorResponse, readJsonBody } from "@/lib/server/http";

const NOTIFICATION_CATEGORIES = [
  "academic",
  "campus",
  "scholarship",
  "daily-summary",
] as const;

type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

interface SendNotificationInput {
  title?: unknown;
  body?: unknown;
  category?: unknown;
  url?: unknown;
  announcementId?: unknown;
  dedupeKey?: unknown;
}

interface SendNotificationRequest {
  title: string;
  body: string;
  category: NotificationCategory;
  url?: string;
  announcementId?: string;
  dedupeKey?: string;
}

interface NotificationSendResult {
  tokensCount: number;
  successCount: number;
  failureCount: number;
}

interface NotificationSendLock {
  ref: DocumentReference;
  alreadySent?: NotificationSendResult;
}

export async function POST(req: NextRequest) {
  let sendLock: NotificationSendLock | null = null;

  try {
    const configuredApiKey = process.env.PUSH_API_KEY;
    const apiKey = req.headers.get("x-api-key");

    if (!configuredApiKey) {
      console.error("[Notification API] PUSH_API_KEY is not configured");
      return NextResponse.json(
        { error: "알림 발송 설정이 완료되지 않았습니다" },
        { status: 503 },
      );
    }

    if (!apiKey || !matchesApiKey(apiKey, configuredApiKey)) {
      return NextResponse.json(
        { error: "인증되지 않았습니다" },
        { status: 401 },
      );
    }

    const request = readNotificationRequest(
      await readJsonBody<SendNotificationInput>(req, 8 * 1024),
    );
    const { title, body, category, url, announcementId } = request;

    initializeFirebaseAdmin();
    const db = admin.firestore();
    sendLock = await acquireNotificationSendLock(db, request);

    if (sendLock?.alreadySent) {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        message: "같은 알림 요청이 이미 처리되어 재발송하지 않았습니다",
        data: sendLock.alreadySent,
      });
    }

    const snapshot = await db
      .collection("user_devices")
      .where("active", "==", true)
      .get();

    const tokens = snapshot.docs.map((doc) => {
      const data = doc.data();
      return data.fcm_token;
    }).filter((token): token is string => typeof token === "string");

    if (tokens.length === 0) {
      const data = { tokensCount: 0, successCount: 0, failureCount: 0 };
      await recordNotificationResult(db, request, data, sendLock?.ref);

      return NextResponse.json({
        success: true,
        message: "구독자가 없습니다",
        data,
      });
    }

    const result = await sendFCMMessage(tokens, title, body, {
      category,
      url: url || "/",
      announcementId: announcementId || "",
    });

    await deleteInvalidTokens(db, result.invalidTokens);

    const data = {
      tokensCount: tokens.length,
      successCount: result.successCount,
      failureCount: result.failureCount,
    };
    await recordNotificationResult(db, request, data, sendLock?.ref);

    return NextResponse.json({
      success: true,
      message: "푸시 알림이 발송되었습니다",
      data,
    });
  } catch (error) {
    if (sendLock && !sendLock.alreadySent) {
      await markNotificationSendLockFailed(sendLock.ref, error).catch(
        (lockError) => {
          console.error("[Notification API] Failed to mark send lock failed", lockError);
        },
      );
    }

    if (error instanceof NotificationRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[API] 발송 오류:", error);
    return apiErrorResponse(error, "알림 발송 중 오류가 발생했습니다");
  }
}

class NotificationRequestError extends Error {}

function readNotificationRequest(
  input: SendNotificationInput,
): SendNotificationRequest {
  const title = readRequiredText(input.title, "title", 100);
  const body = readRequiredText(input.body, "body", 500);
  const category = input.category;

  if (
    typeof category !== "string" ||
    !NOTIFICATION_CATEGORIES.includes(category as NotificationCategory)
  ) {
    throw new NotificationRequestError("category가 올바르지 않습니다");
  }

  return {
    title,
    body,
    category: category as NotificationCategory,
    url: readOptionalUrl(input.url),
    announcementId: readOptionalText(input.announcementId, "announcementId", 200),
    dedupeKey: readOptionalDedupeKey(input.dedupeKey),
  };
}

function readRequiredText(value: unknown, field: string, maxLength: number) {
  const text = readOptionalText(value, field, maxLength);
  if (!text) {
    throw new NotificationRequestError(`${field}가 필요합니다`);
  }
  return text;
}

function readOptionalText(
  value: unknown,
  field: string,
  maxLength: number,
): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new NotificationRequestError(`${field}가 올바르지 않습니다`);
  }

  const text = value.trim();
  if (!text || text.length > maxLength) {
    throw new NotificationRequestError(
      `${field}는 ${maxLength}자 이하여야 합니다`,
    );
  }
  return text;
}

function readOptionalUrl(value: unknown): string | undefined {
  const url = readOptionalText(value, "url", 2048);
  if (!url) return undefined;
  if (url.startsWith("/") && !url.startsWith("//")) return url;

  throw new NotificationRequestError("url은 앱 내부 경로여야 합니다");
}

function readOptionalDedupeKey(value: unknown): string | undefined {
  const dedupeKey = readOptionalText(value, "dedupeKey", 160);
  if (!dedupeKey) return undefined;
  if (/^[A-Za-z0-9._:-]+$/.test(dedupeKey)) return dedupeKey;

  throw new NotificationRequestError(
    "dedupeKey는 영문, 숫자, 점, 밑줄, 콜론, 하이픈만 사용할 수 있습니다",
  );
}

function matchesApiKey(provided: string, configured: string) {
  const providedBuffer = Buffer.from(provided);
  const configuredBuffer = Buffer.from(configured);

  return (
    providedBuffer.length === configuredBuffer.length &&
    timingSafeEqual(providedBuffer, configuredBuffer)
  );
}

async function acquireNotificationSendLock(
  db: Firestore,
  request: SendNotificationRequest,
): Promise<NotificationSendLock | null> {
  if (!request.dedupeKey) return null;

  const ref = db
    .collection("notification_send_locks")
    .doc(hashDedupeKey(request.dedupeKey));
  const requestHash = hashNotificationRequest(request);
  const expiresAt = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + 14 * 86400000),
  );

  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);

    if (snapshot.exists) {
      const existingHash = String(snapshot.get("request_hash") || "");
      if (existingHash !== requestHash) {
        throw new ApiError(
          "같은 dedupeKey로 다른 알림 본문을 발송할 수 없습니다",
          409,
        );
      }

      const status = String(snapshot.get("status") || "sending");
      if (status === "sent") {
        return {
          alreadySent: normalizeSendResult(snapshot.get("data")),
        };
      }

      throw new ApiError(
        status === "failed"
          ? "같은 dedupeKey 알림이 이전 실패 상태입니다. 중복 발송 방지를 위해 수동 확인이 필요합니다"
          : "같은 dedupeKey 알림이 이미 처리 중입니다",
        409,
      );
    }

    const now = admin.firestore.Timestamp.fromDate(new Date());
    transaction.set(ref, {
      dedupe_key: request.dedupeKey,
      request_hash: requestHash,
      status: "sending",
      created_at: now,
      updated_at: now,
      expires_at: expiresAt,
    });

    return {};
  });

  return { ref, alreadySent: result.alreadySent };
}

async function recordNotificationResult(
  db: Firestore,
  request: SendNotificationRequest,
  data: NotificationSendResult,
  lockRef?: DocumentReference,
) {
  const now = admin.firestore.Timestamp.fromDate(new Date());
  const sentRef = request.dedupeKey
    ? db.collection("notifications_sent").doc(hashDedupeKey(request.dedupeKey))
    : db.collection("notifications_sent").doc();

  await sentRef.set({
    title: request.title,
    body: request.body,
    category: request.category,
    url: request.url || "/",
    announcementId: request.announcementId || null,
    dedupeKey: request.dedupeKey || null,
    requestHash: request.dedupeKey ? hashNotificationRequest(request) : null,
    totalTokens: data.tokensCount,
    successCount: data.successCount,
    failureCount: data.failureCount,
    sent_at: now,
  });

  if (lockRef) {
    await lockRef.set(
      {
        status: "sent",
        data,
        notification_sent_id: sentRef.id,
        sent_at: now,
        updated_at: now,
      },
      { merge: true },
    );
  }
}

async function deleteInvalidTokens(db: Firestore, invalidTokens: string[]) {
  await Promise.all(
    invalidTokens.map((token) =>
      db
        .collection("user_devices")
        .doc(createHash("sha256").update(token).digest("hex"))
        .delete()
        .catch((error) => {
          console.error("[Notification API] Failed to delete invalid token", error);
        }),
    ),
  );
}

async function markNotificationSendLockFailed(
  lockRef: DocumentReference,
  error: unknown,
) {
  const now = admin.firestore.Timestamp.fromDate(new Date());
  await lockRef.set(
    {
      status: "failed",
      error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
      failed_at: now,
      updated_at: now,
    },
    { merge: true },
  );
}

function normalizeSendResult(value: unknown): NotificationSendResult {
  if (!value || typeof value !== "object") {
    return { tokensCount: 0, successCount: 0, failureCount: 0 };
  }

  const record = value as Partial<NotificationSendResult>;
  return {
    tokensCount: readCount(record.tokensCount),
    successCount: readCount(record.successCount),
    failureCount: readCount(record.failureCount),
  };
}

function readCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

function hashDedupeKey(dedupeKey: string) {
  return createHash("sha256").update(dedupeKey).digest("hex");
}

function hashNotificationRequest(request: SendNotificationRequest) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        title: request.title,
        body: request.body,
        category: request.category,
        url: request.url || "/",
        announcementId: request.announcementId || "",
        dedupeKey: request.dedupeKey || "",
      }),
    )
    .digest("hex");
}
