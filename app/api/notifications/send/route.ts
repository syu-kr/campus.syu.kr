// app/api/notifications/send/route.ts
// 푸시 알림 발송 API (크롤러에서 호출)

import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { initializeFirebaseAdmin, sendFCMMessage } from "@/lib/firebaseAdmin";

interface SendNotificationRequest {
  title: string;
  body: string;
  category: "academic" | "campus" | "scholarship";
  url?: string;
  announcementId?: string;
}

export async function POST(req: NextRequest) {
  try {
    // API 키로 인증 (환경변수에서)
    const apiKey = req.headers.get("x-api-key");
    if (apiKey !== process.env.PUSH_API_KEY) {
      return NextResponse.json(
        { error: "인증되지 않았습니다" },
        { status: 401 },
      );
    }

    const { title, body, category, url, announcementId } =
      (await req.json()) as SendNotificationRequest;

    // 유효성 검사
    if (!title || !body || !category) {
      return NextResponse.json(
        { error: "필수 필드가 누락되었습니다 (title, body, category)" },
        { status: 400 },
      );
    }

    console.log("[API] 푸시 알림 발송 시작:", {
      title,
      category,
      timestamp: new Date().toISOString(),
    });

    // Firebase Admin 초기화
    initializeFirebaseAdmin();
    const db = admin.firestore();

    // Firestore에서 모든 활성 토큰 조회
    console.log("[API] Firestore에서 토큰 조회 중...");
    const snapshot = await db
      .collection("user_devices")
      .where("active", "==", true)
      .get();

    const tokens = snapshot.docs.map((doc) => doc.data().fcm_token);
    console.log(`[API] ${tokens.length}개의 활성 토큰 발견`);

    if (tokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: "구독자가 없습니다",
        data: { tokensCount: 0 },
      });
    }

    // FCM으로 메시지 발송
    console.log("[API] FCM으로 메시지 발송 중...");
    const result = await sendFCMMessage(tokens, title, body, {
      category,
      url: url || "/",
      announcementId: announcementId || "",
    });

    // 발송 기록을 notifications_sent에 저장
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

    console.log("[API] 푸시 알림 발송 완료");

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
    console.error("[API] 발송 오류:", error);
    return NextResponse.json(
      {
        error: "알림 발송 중 오류가 발생했습니다",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
