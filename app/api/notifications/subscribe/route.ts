// app/api/notifications/subscribe/route.ts
// FCM 토큰 저장 API

import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { initializeFirebaseAdmin } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { fcm_token } = await req.json();

    if (!fcm_token) {
      return NextResponse.json(
        { error: "FCM 토큰이 필요합니다" },
        { status: 400 },
      );
    }

    try {
      initializeFirebaseAdmin();
      const db = admin.firestore();
      const userAgent = req.headers.get("user-agent") || "unknown";
      const docId = Buffer.from(fcm_token).toString("base64").slice(0, 20);

      await db
        .collection("user_devices")
        .doc(docId)
        .set(
          {
            fcm_token,
            user_agent: userAgent,
            created_at: admin.firestore.Timestamp.fromDate(new Date()),
            last_updated: admin.firestore.Timestamp.fromDate(new Date()),
            active: true,
          },
          { merge: true },
        );

      return NextResponse.json({
        success: true,
        message: "FCM 토큰이 저장되었습니다",
        docId,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("[Subscribe] Firestore 저장 실패:", errorMessage);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      return NextResponse.json(
        {
          success: false,
          message: "FCM 토큰 저장 실패",
          error: errorMessage,
          docId: "temp",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[Subscribe] 일반 오류:", errorMessage);
    return NextResponse.json(
      {
        error: "구독 처리 중 오류가 발생했습니다",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}
