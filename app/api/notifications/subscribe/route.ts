// FCM 토큰 저장 API

import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  apiErrorResponse,
  enforceRateLimit,
  getUserAgent,
  readJsonBody,
  rateLimitResponse,
} from "@/lib/server/http";
import { getFirestore, nowTimestamp } from "@/lib/server/firestore";

const RATE_LIMIT = {
  limit: 30,
  windowMs: 60 * 60 * 1000,
};
const TOKEN_RATE_LIMIT = {
  limit: 5,
  windowMs: 60 * 60 * 1000,
};

export async function POST(req: NextRequest) {
  try {
    const { fcm_token } = await readJsonBody<{ fcm_token?: unknown }>(
      req,
      8 * 1024,
    );
    await enforceRateLimit(req, "notification-subscribe", RATE_LIMIT);

    if (!isValidFcmToken(fcm_token)) {
      return NextResponse.json(
        { error: "올바른 FCM 토큰이 필요합니다" },
        { status: 400 },
      );
    }

    await enforceRateLimit(
      req,
      `notification-token:${getTokenDocumentId(fcm_token)}`,
      TOKEN_RATE_LIMIT,
    );

    const db = getFirestore();
    const userAgent = getUserAgent(req);
    const docId = getTokenDocumentId(fcm_token);
    const legacyDocId = getLegacyTokenDocumentId(fcm_token);

    const writes: Promise<unknown>[] = [
      db
        .collection("user_devices")
        .doc(docId)
        .set(
          {
            fcm_token,
            user_agent: userAgent,
            created_at: nowTimestamp(),
            last_updated: nowTimestamp(),
            active: true,
          },
          { merge: true },
        ),
    ];

    if (legacyDocId) {
      writes.push(db.collection("user_devices").doc(legacyDocId).delete());
    }

    await Promise.all(writes);

    return NextResponse.json({
      success: true,
      message: "FCM 토큰이 저장되었습니다",
    });
  } catch (error) {
    const rateLimited = rateLimitResponse(error);
    if (rateLimited) return rateLimited;

    return apiErrorResponse(error, "구독 처리 중 오류가 발생했습니다");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { fcm_token } = await readJsonBody<{ fcm_token?: unknown }>(
      req,
      8 * 1024,
    );
    await enforceRateLimit(req, "notification-unsubscribe", RATE_LIMIT);

    if (!isValidFcmToken(fcm_token)) {
      return NextResponse.json(
        { error: "올바른 FCM 토큰이 필요합니다" },
        { status: 400 },
      );
    }

    await enforceRateLimit(
      req,
      `notification-token:${getTokenDocumentId(fcm_token)}`,
      TOKEN_RATE_LIMIT,
    );

    const db = getFirestore();
    const documentIds = [
      getTokenDocumentId(fcm_token),
      getLegacyTokenDocumentId(fcm_token),
    ].filter((id): id is string => Boolean(id));

    await Promise.all(
      documentIds.map((id) => db.collection("user_devices").doc(id).delete()),
    );

    return NextResponse.json({
      success: true,
      message: "FCM 토큰이 제거되었습니다",
    });
  } catch (error) {
    const rateLimited = rateLimitResponse(error);
    if (rateLimited) return rateLimited;

    return apiErrorResponse(error, "알림 구독 해제 중 오류가 발생했습니다");
  }
}

function isValidFcmToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length >= 20 &&
    value.length <= 4096
  );
}

function getTokenDocumentId(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getLegacyTokenDocumentId(token: string) {
  const documentId = Buffer.from(token).toString("base64").slice(0, 20);
  return documentId.includes("/") ? null : documentId;
}
