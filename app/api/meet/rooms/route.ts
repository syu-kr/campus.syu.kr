import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildMeetSlots, normalizeMeetRoomInput } from "@/lib/meet";
import {
  admin,
  getFirestore,
  nowTimestamp,
} from "@/lib/server/firestore";
import {
  apiErrorResponse,
  enforceRateLimit,
  rateLimitResponse,
} from "@/lib/server/http";

const ROOM_EXPIRY_DAYS = 90;
const RESPONSE_WINDOW_HOURS = 24;
const RATE_LIMIT = {
  limit: 10,
  windowMs: 60 * 60 * 1000,
};

export async function POST(req: NextRequest) {
  try {
    enforceRateLimit(req, "meet_rooms", RATE_LIMIT);

    const input = normalizeMeetRoomInput(await req.json());
    const slots = buildMeetSlots(input);

    const db = getFirestore();
    const roomId = await createUniqueRoomId(db);
    const now = nowTimestamp();
    const responseClosesAt = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + RESPONSE_WINDOW_HOURS * 60 * 60 * 1000),
    );
    const expiresAt = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + ROOM_EXPIRY_DAYS * 86400000),
    );

    await db.collection("meet_rooms").doc(roomId).set({
      title: input.title,
      description: input.description,
      date_start: input.dateStart,
      date_end: input.dateEnd,
      time_start: input.timeStart,
      time_end: input.timeEnd,
      slot_minutes: input.slotMinutes,
      created_at: now,
      updated_at: now,
      response_closes_at: responseClosesAt,
      expires_at: expiresAt,
      participant_count: 0,
    });

    const inviteUrl = new URL(`/more/meet/${roomId}`, req.url).toString();

    return NextResponse.json({
      roomId,
      inviteUrl,
      slots,
    });
  } catch (error) {
    const rateLimited = rateLimitResponse(error);
    if (rateLimited) return rateLimited;

    return apiErrorResponse(error, "방을 만들 수 없습니다");
  }
}

async function createUniqueRoomId(
  db: admin.firestore.Firestore,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = randomBytes(12).toString("base64url");
    const snapshot = await db.collection("meet_rooms").doc(id).get();

    if (!snapshot.exists) {
      return id;
    }
  }

  throw new Error("초대 코드를 생성하지 못했습니다. 다시 시도해주세요");
}
