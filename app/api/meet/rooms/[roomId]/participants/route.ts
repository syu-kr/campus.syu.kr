import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildMeetSlots, filterValidAvailability } from "@/lib/meet";
import { admin, getFirestore, nowTimestamp } from "@/lib/server/firestore";
import { apiServerErrorResponse } from "@/lib/server/http";

interface RouteContext {
  params: {
    roomId: string;
  };
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const body = await req.json();
    const nickname = String(body.nickname || "").trim();

    if (!nickname || nickname.length > 30) {
      return NextResponse.json(
        { error: "닉네임은 1자 이상 30자 이하로 입력해주세요" },
        { status: 400 },
      );
    }

    const db = getFirestore();
    const roomRef = db.collection("meet_rooms").doc(params.roomId);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return NextResponse.json(
        { error: "일정 방을 찾을 수 없습니다" },
        { status: 404 },
      );
    }

    const room = roomDoc.data() || {};
    const responseClosesAt = room.response_closes_at;
    if (
      responseClosesAt instanceof admin.firestore.Timestamp &&
      responseClosesAt.toMillis() <= Date.now()
    ) {
      return NextResponse.json(
        { error: "이 일정 방은 응답 시간이 마감되어 결과만 볼 수 있습니다" },
        { status: 403 },
      );
    }

    const slots = buildMeetSlots({
      dateStart: String(room.date_start || ""),
      dateEnd: String(room.date_end || ""),
      timeStart: String(room.time_start || ""),
      timeEnd: String(room.time_end || ""),
      slotMinutes: Number(room.slot_minutes || 30),
    });
    const availability = filterValidAvailability(body.availability, slots);
    const participantRef = roomRef
      .collection("participants")
      .doc(createNicknameKey(nickname));
    const now = nowTimestamp();

    await db.runTransaction(async (transaction) => {
      const participantDoc = await transaction.get(participantRef);

      transaction.set(
        participantRef,
        {
          nickname,
          availability,
          created_at: participantDoc.exists
            ? participantDoc.get("created_at") || now
            : now,
          updated_at: now,
        },
        { merge: true },
      );

      transaction.update(roomRef, {
        updated_at: now,
        participant_count: admin.firestore.FieldValue.increment(
          participantDoc.exists ? 0 : 1,
        ),
      });
    });

    return NextResponse.json({
      success: true,
      nickname,
      availability,
    });
  } catch (error) {
    return apiServerErrorResponse(error, "참여 정보를 저장하지 못했습니다");
  }
}

function createNicknameKey(nickname: string): string {
  return createHash("sha256")
    .update(nickname.trim().toLocaleLowerCase("ko-KR"))
    .digest("hex")
    .slice(0, 32);
}
