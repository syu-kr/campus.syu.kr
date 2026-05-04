import { NextRequest, NextResponse } from "next/server";
import { getSubmissionErrorField, normalizeSiteInquiry } from "@/lib/submissions";
import {
  apiErrorResponse,
  enforceRateLimit,
  getUserAgent,
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
    enforceRateLimit(req, "site_inquiries", RATE_LIMIT);

    const input = normalizeSiteInquiry(await req.json());

    const db = getFirestore();
    const now = nowTimestamp();

    const docRef = await db.collection("site_inquiries").add({
      type: input.type,
      title: input.title,
      message: input.message,
      page_url: input.pageUrl,
      contact: input.contact,
      status: "pending",
      created_at: now,
      updated_at: now,
      user_agent: getUserAgent(req),
    });

    return NextResponse.json({
      success: true,
      id: docRef.id,
      message: "문의가 접수되었습니다",
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

    return apiErrorResponse(error, "문의를 접수하지 못했습니다");
  }
}
