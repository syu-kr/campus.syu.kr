import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildMeetSlots, filterValidAvailability } from "@/lib/meet";
import { admin, getFirestore, nowTimestamp } from "@/lib/server/firestore";
import {
  ApiError,
  apiServerErrorResponse,
  enforceRateLimit,
  readJsonBody,
  rateLimitResponse,
} from "@/lib/server/http";

const RATE_LIMIT = {
  limit: 60,
  windowMs: 60 * 60 * 1000,
};
const MAX_PARTICIPANTS = 100;

interface RouteContext {
  params: Promise<{
    roomId: string;
  }>;
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const { roomId } = await params;
    assertValidRoomId(roomId);
    await enforceRateLimit(req, `meet-participants:${roomId}`, RATE_LIMIT);
    const body = await readJsonBody<Record<string, unknown>>(req, 32 * 1024);
    const nickname = String(body.nickname || "").trim();
    const editToken =
      typeof body.editToken === "string" ? body.editToken.trim() : "";

    if (!nickname || nickname.length > 30) {
      return NextResponse.json(
        { error: "닉네임은 1자 이상 30자 이하로 입력해주세요" },
        { status: 400 },
      );
    }

    const db = getFirestore();
    const roomRef = db.collection("meet_rooms").doc(roomId);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return NextResponse.json(
        { error: "일정 방을 찾을 수 없습니다" },
        { status: 404 },
      );
    }

    const room = roomDoc.data() || {};
    if (isExpired(room.expires_at)) {
      return NextResponse.json(
        { error: "일정 방을 찾을 수 없습니다" },
        { status: 404 },
      );
    }

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
    const issuedEditToken = randomBytes(32).toString("base64url");
    let isNewParticipant = false;

    await db.runTransaction(async (transaction) => {
      const [currentRoomDoc, participantDoc] = await Promise.all([
        transaction.get(roomRef),
        transaction.get(participantRef),
      ]);
      const currentRoom = currentRoomDoc.data() || {};
      const existingTokenHash = participantDoc.get("edit_token_hash");

      if (!currentRoomDoc.exists || isExpired(currentRoom.expires_at)) {
        throw new ApiError("일정 방을 찾을 수 없습니다", 404);
      }

      if (
        currentRoom.response_closes_at instanceof admin.firestore.Timestamp &&
        currentRoom.response_closes_at.toMillis() <= Date.now()
      ) {
        throw new ApiError(
          "이 일정 방은 응답 시간이 마감되어 결과만 볼 수 있습니다",
          403,
        );
      }

      if (participantDoc.exists) {
        if (
          typeof existingTokenHash !== "string" ||
          !editToken ||
          !matchesEditToken(editToken, existingTokenHash)
        ) {
          throw new ApiError(
            "이 닉네임의 기존 응답을 수정할 권한이 없습니다. 다른 닉네임을 사용해주세요.",
            403,
          );
        }
      } else {
        if (Number(currentRoom.participant_count || 0) >= MAX_PARTICIPANTS) {
          throw new ApiError("이 일정 방의 최대 참여자 수에 도달했습니다", 409);
        }
        isNewParticipant = true;
      }

      transaction.set(
        participantRef,
        {
          nickname,
          availability,
          created_at: participantDoc.exists
            ? participantDoc.get("created_at") || now
            : now,
          updated_at: now,
          expires_at: currentRoom.expires_at,
          edit_token_hash: participantDoc.exists
            ? existingTokenHash
            : hashEditToken(issuedEditToken),
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
      ...(isNewParticipant ? { editToken: issuedEditToken } : {}),
    });
  } catch (error) {
    const rateLimited = rateLimitResponse(error);
    if (rateLimited) return rateLimited;

    return apiServerErrorResponse(error, "참여 정보를 저장하지 못했습니다");
  }
}

function createNicknameKey(nickname: string): string {
  return createHash("sha256")
    .update(nickname.trim().toLocaleLowerCase("ko-KR"))
    .digest("hex")
    .slice(0, 32);
}

function hashEditToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function matchesEditToken(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashEditToken(token));
  const expected = Buffer.from(expectedHash);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function assertValidRoomId(roomId: string) {
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(roomId)) {
    throw new ApiError("일정 방 코드 형식이 올바르지 않습니다", 400);
  }
}

function isExpired(value: unknown) {
  return (
    value instanceof admin.firestore.Timestamp &&
    value.toMillis() <= Date.now()
  );
}
