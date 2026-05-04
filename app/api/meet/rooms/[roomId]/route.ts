import { NextResponse } from "next/server";
import { buildMeetSlots } from "@/lib/meet";
import type { MeetParticipant, MeetRoom, MeetRoomResponse } from "@/types/meet";
import { getFirestore, timestampToIso } from "@/lib/server/firestore";
import { apiServerErrorResponse } from "@/lib/server/http";

interface RouteContext {
  params: {
    roomId: string;
  };
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const db = getFirestore();
    const roomDoc = await db.collection("meet_rooms").doc(params.roomId).get();

    if (!roomDoc.exists) {
      return NextResponse.json(
        { error: "일정 방을 찾을 수 없습니다" },
        { status: 404 },
      );
    }

    const data = roomDoc.data() || {};
    const responseClosesAt = timestampToIso(data.response_closes_at);
    const room: MeetRoom = {
      id: params.roomId,
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
    return apiServerErrorResponse(error, "일정 방 정보를 불러오지 못했습니다");
  }
}
