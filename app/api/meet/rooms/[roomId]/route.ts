import { NextRequest, NextResponse } from "next/server";
import { buildMeetSlots } from "@/lib/meet";
import type { MeetParticipant, MeetRoom, MeetRoomResponse } from "@/types/meet";
import { admin, getFirestore, timestampToIso } from "@/lib/server/firestore";
import {
  ApiError,
  apiServerErrorResponse,
  enforceRateLimit,
  rateLimitResponse,
} from "@/lib/server/http";

const RATE_LIMIT = {
  limit: 120,
  windowMs: 60 * 60 * 1000,
  persistent: false,
};

interface RouteContext {
  params: Promise<{
    roomId: string;
  }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { roomId } = await params;
    if (!/^[A-Za-z0-9_-]{8,32}$/.test(roomId)) {
      throw new ApiError("일정 방 코드 형식이 올바르지 않습니다", 400);
    }

    await enforceRateLimit(req, `meet-room:${roomId}`, RATE_LIMIT);

    const db = getFirestore();
    const roomDoc = await db.collection("meet_rooms").doc(roomId).get();

    if (!roomDoc.exists) {
      return NextResponse.json(
        { error: "일정 방을 찾을 수 없습니다" },
        { status: 404 },
      );
    }

    const data = roomDoc.data() || {};
    if (
      data.expires_at instanceof admin.firestore.Timestamp &&
      data.expires_at.toMillis() <= Date.now()
    ) {
      return NextResponse.json(
        { error: "일정 방을 찾을 수 없습니다" },
        { status: 404 },
      );
    }

    const responseClosesAt = timestampToIso(data.response_closes_at);
    const room: MeetRoom = {
      id: roomId,
      title: String(data.title || ""),
      description: String(data.description || ""),
      dateStart: String(data.date_start || ""),
      dateEnd: String(data.date_end || ""),
      timeStart: String(data.time_start || ""),
      timeEnd: String(data.time_end || ""),
      slotMinutes: Number(data.slot_minutes || 30),
      participantCount: Number(data.participant_count || 0),
      responseClosesAt,
      acceptingResponses:
        !responseClosesAt || new Date(responseClosesAt).getTime() > Date.now(),
      expiresAt: timestampToIso(data.expires_at),
    };

    const slots = buildMeetSlots({
      dateStart: room.dateStart,
      dateEnd: room.dateEnd,
      timeStart: room.timeStart,
      timeEnd: room.timeEnd,
      slotMinutes: room.slotMinutes,
    });

    const participantsSnapshot = await roomDoc.ref
      .collection("participants")
      .orderBy("updated_at", "desc")
      .get();

    const participants: MeetParticipant[] = participantsSnapshot.docs.map(
      (participantDoc) => {
        const participant = participantDoc.data();
        return {
          nickname: String(participant.nickname || ""),
          availability: Array.isArray(participant.availability)
            ? participant.availability.filter(
                (slot): slot is string => typeof slot === "string",
              )
            : [],
          updatedAt: timestampToIso(participant.updated_at),
        };
      },
    );

    const response: MeetRoomResponse = {
      room,
      slots,
      participants,
    };

    return NextResponse.json(response);
  } catch (error) {
    const rateLimited = rateLimitResponse(error);
    if (rateLimited) return rateLimited;

    return apiServerErrorResponse(error, "일정 방 정보를 불러오지 못했습니다");
  }
}
