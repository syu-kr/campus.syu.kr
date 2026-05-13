import { NextResponse } from "next/server";

import {
  ApiError,
  apiServerErrorResponse,
} from "@/lib/server/http";
import { getFirestore, timestampToIso } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    shareId: string;
  };
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const shareId = normalizeShareId(params.shareId);
    const snapshot = await getFirestore()
      .collection("timetable_shares")
      .doc(shareId)
      .get();

    if (!snapshot.exists) {
      throw new ApiError("공유 시간표를 찾을 수 없습니다.", 404);
    }

    const data = snapshot.data() ?? {};
    const courseIds = Array.isArray(data.course_ids)
      ? data.course_ids.filter((item): item is string => typeof item === "string")
      : [];

    return NextResponse.json({
      success: true,
      data: {
        shareId,
        courseIds,
        year: typeof data.year === "string" ? data.year : null,
        semester: typeof data.semester === "string" ? data.semester : null,
        createdAt: timestampToIso(data.created_at),
      },
    });
  } catch (error) {
    return apiServerErrorResponse(error, "공유 시간표를 불러오지 못했습니다.");
  }
}

function normalizeShareId(value: string) {
  const shareId = value.trim();

  if (!/^[A-Za-z0-9_-]{6,24}$/.test(shareId)) {
    throw new ApiError("공유 링크 형식이 올바르지 않습니다.", 400);
  }

  return shareId;
}
