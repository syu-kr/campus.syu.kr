import { NextResponse } from "next/server";
import { requireServerEnv } from "@/lib/server/env";

// 🚀 빌드 최적화: 이 라우트를 동적으로 처리 (빌드 시간 단축)
export const dynamic = "force-dynamic";

const LIBRARY_CACHE_TTL_MS = 60 * 1000;
const LIBRARY_STALE_RETENTION_MS = 30 * 60 * 1000;
let cachedRooms:
  | {
      rooms: ReadingRoom[];
      fetchedAt: number;
      expiresAt: number;
    }
  | undefined;
let pendingRooms: Promise<ReadingRoom[]> | undefined;

interface ReadingRoom {
  id: number;
  strRoomNm: string;
  strTotalSeat: number;
  strUseSeat: number;
  strRemainSeat: number;
  lastUpdated: string;
}

export async function GET() {
  const now = Date.now();

  try {
    if (cachedRooms && cachedRooms.expiresAt > now) {
      return libraryJson(cachedRooms.rooms);
    }

    pendingRooms ??= fetchReadingRooms().finally(() => {
      pendingRooms = undefined;
    });

    const rooms = await pendingRooms;
    cachedRooms = {
      rooms,
      fetchedAt: Date.now(),
      expiresAt: Date.now() + LIBRARY_CACHE_TTL_MS,
    };

    return libraryJson(rooms);
  } catch (error) {
    console.error("Failed to fetch reading rooms:", error);

    if (
      cachedRooms &&
      cachedRooms.fetchedAt + LIBRARY_STALE_RETENTION_MS > now
    ) {
      return libraryJson(cachedRooms.rooms, true);
    }

    return NextResponse.json(
      { error: "Failed to fetch reading room status" },
      {
        status: 502,
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      },
    );
  }
}

async function fetchReadingRooms(): Promise<ReadingRoom[]> {
  const response = await fetch(requireServerEnv("LIBRARY_READING_ROOMS_URL"), {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }

  const text = await response.text();
  const roomRegex =
    /<item>[\s\S]*?<strRoomNm><!\[CDATA\[([^\]]+)\]\]><\/strRoomNm>[\s\S]*?<strTotalSeat><!\[CDATA\[([^\]]+)\]\]><\/strTotalSeat>[\s\S]*?<strUseSeat><!\[CDATA\[([^\]]+)\]\]><\/strUseSeat>[\s\S]*?<strRemainSeat><!\[CDATA\[([^\]]+)\]\]><\/strRemainSeat>[\s\S]*?<\/item>/g;
  const rooms: ReadingRoom[] = [];
  let match;

  while ((match = roomRegex.exec(text)) !== null) {
    rooms.push({
      id: rooms.length,
      strRoomNm: match[1],
      strTotalSeat: parseInt(match[2]),
      strUseSeat: parseInt(match[3]),
      strRemainSeat: parseInt(match[4]),
      lastUpdated: new Date().toISOString(),
    });
  }

  return rooms;
}

function libraryJson(rooms: ReadingRoom[], stale = false) {
  return NextResponse.json(rooms, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      ...(stale ? { "X-Library-Stale": "1" } : {}),
    },
  });
}
