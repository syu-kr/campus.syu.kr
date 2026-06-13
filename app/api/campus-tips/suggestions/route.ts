import { NextRequest, NextResponse } from "next/server";
import {
  getSubmissionErrorField,
  normalizeCampusTipSuggestion,
} from "@/lib/submissions";
import {
  apiErrorResponse,
  enforceRateLimit,
  getUserAgent,
  readJsonBody,
  rateLimitResponse,
} from "@/lib/server/http";
import { getFirestore, nowTimestamp } from "@/lib/server/firestore";
import { SubmissionValidationError } from "@/types/submissions";

const RATE_LIMIT = {
  limit: 5,
  windowMs: 60 * 60 * 1000,
};

export async function POST(req: NextRequest) {
  try {
    const input = normalizeCampusTipSuggestion(await readJsonBody(req, 8 * 1024));
    await enforceRateLimit(req, "campus_tip_suggestions", RATE_LIMIT);

    const db = getFirestore();
    const now = nowTimestamp();

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
      user_agent: getUserAgent(req),
    });

    return NextResponse.json({
      success: true,
      id: docRef.id,
      message: "꿀팁 제보가 접수되었습니다",
    });
  } catch (error) {
    const rateLimited = rateLimitResponse(error);
    if (rateLimited) return rateLimited;

    if (error instanceof SubmissionValidationError) {
      return NextResponse.json(
        { error: error.message, field: getSubmissionErrorField(error) },
        { status: 400 },
      );
    }

    return apiErrorResponse(error, "꿀팁 제보를 접수하지 못했습니다");
  }
}
