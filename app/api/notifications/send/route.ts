// 푸시 알림 발송 API (크롤러에서 호출)

import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { initializeFirebaseAdmin } from "@/lib/firebaseAdmin";
import { sendFCMMessage } from "@/lib/firebaseMessaging";
import { admin } from "@/lib/server/firestore";
import { apiErrorResponse, readJsonBody } from "@/lib/server/http";

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
}

interface SendNotificationRequest {
  title: string;
  body: string;
  category: NotificationCategory;
  url?: string;
  announcementId?: string;
}

export async function POST(req: NextRequest) {
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

    const { title, body, category, url, announcementId } =
      readNotificationRequest(await readJsonBody<SendNotificationInput>(req, 8 * 1024));

    initializeFirebaseAdmin();
    const db = admin.firestore();

    const snapshot = await db
      .collection("user_devices")
      .where("active", "==", true)
      .get();

    const tokens = snapshot.docs.map((doc) => {
      const data = doc.data();
      return data.fcm_token;
    }).filter((token): token is string => typeof token === "string");

    if (tokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: "구독자가 없습니다",
        data: { tokensCount: 0 },
      });
    }

    const result = await sendFCMMessage(tokens, title, body, {
      category,
      url: url || "/",
      announcementId: announcementId || "",
    });

    await Promise.all(
      result.invalidTokens.map((token) =>
        db
          .collection("user_devices")
          .doc(createHash("sha256").update(token).digest("hex"))
          .delete(),
      ),
    );

    await db.collection("notifications_sent").add({
      title,
      body,
      category,
      url: url || "/",
      announcementId: announcementId || null,
      totalTokens: tokens.length,
      successCount: result.successCount,
      failureCount: result.failureCount,
      sent_at: admin.firestore.Timestamp.fromDate(new Date()),
    });

    return NextResponse.json({
      success: true,
      message: "푸시 알림이 발송되었습니다",
      data: {
        tokensCount: tokens.length,
        successCount: result.successCount,
        failureCount: result.failureCount,
      },
    });
  } catch (error) {
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

function matchesApiKey(provided: string, configured: string) {
  const providedBuffer = Buffer.from(provided);
  const configuredBuffer = Buffer.from(configured);

  return (
    providedBuffer.length === configuredBuffer.length &&
    timingSafeEqual(providedBuffer, configuredBuffer)
  );
}
