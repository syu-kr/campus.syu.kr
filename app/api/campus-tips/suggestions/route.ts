import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { initializeFirebaseAdmin } from "@/lib/firebaseAdmin";
import {
  getSubmissionErrorField,
  normalizeCampusTipSuggestion,
} from "@/lib/submissions";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const RATE_LIMIT = {
  limit: 5,
  windowMs: 60 * 60 * 1000,
};

export async function POST(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(
      getRateLimitKey(req, "campus_tip_suggestions"),
      RATE_LIMIT,
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `요청이 많습니다. ${rateLimit.retryAfterSeconds}초 후 다시 시도해주세요.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    const input = normalizeCampusTipSuggestion(await req.json());

    initializeFirebaseAdmin();
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    const docRef = await db.collection("campus_tip_suggestions").add({
      title: input.title,
      category: input.category,
      description: input.description,
      url: input.url,
      tags: input.tags,
      note: input.note,
      contact: input.contact,
      status: "pending",
      created_at: now,
      updated_at: now,
      user_agent: req.headers.get("user-agent") || "unknown",
    });

    return NextResponse.json({
      success: true,
      id: docRef.id,
      message: "꿀팁 제보가 접수되었습니다",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "꿀팁 제보를 접수하지 못했습니다";
    return NextResponse.json(
      { error: message, field: getSubmissionErrorField(error) },
      { status: 400 },
    );
  }
}
