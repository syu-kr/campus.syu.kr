import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  apiServerErrorResponse,
  enforceRateLimit,
  enforceSameOrigin,
  rateLimitResponse,
} from "@/lib/server/http";
import {
  admin,
  getFirestore,
  timestampToIso,
} from "@/lib/server/firestore";
import { parseSharedTimetableWorkspace } from "@/lib/timetable-share";
import { matchesOwnerToken } from "@/lib/server/owner-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{
    shareId: string;
  }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { shareId: rawShareId } = await params;
    const shareId = normalizeShareId(rawShareId);
    const snapshot = await getFirestore()
      .collection("timetable_shares")
      .doc(shareId)
      .get();

    if (!snapshot.exists) {
      throw new ApiError("공유 시간표를 찾을 수 없습니다.", 404);
    }

    const data = snapshot.data() ?? {};
    if (
      data.expires_at instanceof admin.firestore.Timestamp &&
      data.expires_at.toMillis() <= Date.now()
    ) {
      throw new ApiError("공유 시간표를 찾을 수 없습니다.", 404);
    }

    const courseIds = Array.isArray(data.course_ids)
      ? data.course_ids.filter((item): item is string => typeof item === "string")
      : [];
    const workspace = parseSharedTimetableWorkspace(data.workspace);

    return NextResponse.json({
      success: true,
      data: {
        shareId,
        courseIds,
        ...(workspace ? { workspace } : {}),
        year: typeof data.year === "string" ? data.year : null,
        semester: typeof data.semester === "string" ? data.semester : null,
        createdAt: timestampToIso(data.created_at),
      },
    });
  } catch (error) {
    return apiServerErrorResponse(error, "공유 시간표를 불러오지 못했습니다.");
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { shareId: rawShareId } = await params;
    const shareId = normalizeShareId(rawShareId);
    enforceSameOrigin(req);
    await enforceRateLimit(req, `timetable-share-delete:${shareId}`, {
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });

    const shareRef = getFirestore()
      .collection("timetable_shares")
      .doc(shareId);
    const snapshot = await shareRef.get();
    if (!snapshot.exists) {
      throw new ApiError("공유 시간표를 찾을 수 없습니다.", 404);
    }

    if (
      !matchesOwnerToken(
        req.headers.get("x-owner-token")?.trim() || "",
        snapshot.get("owner_token_hash"),
      )
    ) {
      throw new ApiError("공유 링크를 삭제할 권한이 없습니다.", 403);
    }

    await shareRef.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    const rateLimited = rateLimitResponse(error);
    if (rateLimited) return rateLimited;

    return apiServerErrorResponse(error, "공유 링크를 삭제하지 못했습니다.");
  }
}

function normalizeShareId(value: string) {
  const shareId = value.trim();

  if (!/^[A-Za-z0-9_-]{6,24}$/.test(shareId)) {
    throw new ApiError("공유 링크 형식이 올바르지 않습니다.", 400);
  }

  return shareId;
}
