import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  ApiError,
  apiServerErrorResponse,
  enforceRateLimit,
  getUserAgent,
  readJsonBody,
  rateLimitResponse,
} from "@/lib/server/http";
import { getFirestore, nowTimestamp } from "@/lib/server/firestore";
import { admin } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = {
  limit: 20,
  windowMs: 60 * 60 * 1000,
};

const MAX_SHARED_COURSES = 120;
const SHARE_ID_ATTEMPTS = 5;
const SHARE_EXPIRY_DAYS = 90;

interface ShareRequestBody {
  courseIds?: unknown;
  year?: unknown;
  semester?: unknown;
}

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody<ShareRequestBody>(req, 32 * 1024);
    await enforceRateLimit(req, "lecture_timetable_shares", RATE_LIMIT);
    const courseIds = normalizeCourseIds(body.courseIds);
    const year = normalizeOptionalString(body.year, 20);
    const semester = normalizeOptionalString(body.semester, 40);

    if (courseIds.length === 0) {
      throw new ApiError("공유할 강의를 선택해 주세요.", 400, "courseIds");
    }

    const db = getFirestore();
    const now = nowTimestamp();
    const shareId = await createUniqueShareId();
    const expiresAt = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + SHARE_EXPIRY_DAYS * 86400000),
    );

    await db.collection("timetable_shares").doc(shareId).set({
      course_ids: courseIds,
      year,
      semester,
      created_at: now,
      updated_at: now,
      expires_at: expiresAt,
      user_agent: getUserAgent(req),
    });

    return NextResponse.json({
      success: true,
      shareId,
    });
  } catch (error) {
    const rateLimited = rateLimitResponse(error);
    if (rateLimited) return rateLimited;

    return apiServerErrorResponse(
      error,
      "시간표 공유 링크를 만들지 못했습니다.",
    );
  }
}

async function createUniqueShareId() {
  const db = getFirestore();

  for (let attempt = 0; attempt < SHARE_ID_ATTEMPTS; attempt += 1) {
    const shareId = randomBytes(6).toString("base64url");
    const snapshot = await db.collection("timetable_shares").doc(shareId).get();

    if (!snapshot.exists) return shareId;
  }

  throw new ApiError("공유 링크를 만들지 못했습니다.", 500);
}

function normalizeCourseIds(value: unknown) {
  if (!Array.isArray(value)) {
    throw new ApiError("강의 목록 형식이 올바르지 않습니다.", 400, "courseIds");
  }

  const courseIds = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  if (courseIds.length > MAX_SHARED_COURSES) {
    throw new ApiError(
      `공유 가능한 강의는 최대 ${MAX_SHARED_COURSES}개입니다.`,
      400,
      "courseIds",
    );
  }

  const uniqueIds = Array.from(new Set(courseIds));

  uniqueIds.forEach((courseId) => {
    if (courseId.length > 120) {
      throw new ApiError("강의 식별자가 너무 깁니다.", 400, "courseIds");
    }
  });

  return uniqueIds;
}

function normalizeOptionalString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return trimmed.slice(0, maxLength);
}
