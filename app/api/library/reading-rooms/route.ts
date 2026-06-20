import { NextResponse } from "next/server";
import { requireServerEnv } from "@/lib/server/env";
import type { LiveDataResponse } from "@/types/live-data";

// 🚀 빌드 최적화: 이 라우트를 동적으로 처리 (빌드 시간 단축)
export const dynamic = "force-dynamic";

const LIBRARY_CACHE_TTL_MS = 60 * 1000;
const LIBRARY_STALE_RETENTION_MS = 30 * 60 * 1000;
const LIBRARY_SOURCE = "library-reading-room";
let cachedRooms:
  | {
      rooms: ReadingRoom[];
      timestamp: string;
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
      return libraryJson(cachedRooms.rooms, cachedRooms.timestamp);
    }

    pendingRooms ??= fetchReadingRooms().finally(() => {
      pendingRooms = undefined;
    });

    const rooms = await pendingRooms;
    const timestamp = new Date().toISOString();
    cachedRooms = {
      rooms,
      timestamp,
      fetchedAt: Date.now(),
      expiresAt: Date.now() + LIBRARY_CACHE_TTL_MS,
    };

    return libraryJson(rooms, timestamp);
  } catch (error) {
    console.error("Failed to fetch reading rooms:", error);

    if (
      cachedRooms &&
      cachedRooms.fetchedAt + LIBRARY_STALE_RETENTION_MS > now
    ) {
      return libraryJson(cachedRooms.rooms, cachedRooms.timestamp, true);
    }

    return NextResponse.json(
      {
        success: false,
        source: LIBRARY_SOURCE,
        data: [],
        timestamp: new Date().toISOString(),
        stale: false,
        sourceStatus: "error",
        error: "Failed to fetch reading room status",
      } satisfies LiveDataResponse<ReadingRoom[]>,
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
    const totalSeat = parseInt(match[2], 10);
    const useSeat = parseInt(match[3], 10);
    const remainSeat = parseInt(match[4], 10);

    if (
      !Number.isFinite(totalSeat) ||
      !Number.isFinite(useSeat) ||
      !Number.isFinite(remainSeat)
    ) {
      throw new Error("Reading room API returned invalid seat counts");
    }

    rooms.push({
      id: rooms.length,
      strRoomNm: match[1],
      strTotalSeat: totalSeat,
      strUseSeat: useSeat,
      strRemainSeat: remainSeat,
      lastUpdated: new Date().toISOString(),
    });
  }

  if (rooms.length === 0) {
    throw new Error(
      text.trim().length > 0
        ? "Reading room API returned no parseable room items"
        : "Reading room API returned an empty response",
    );
  }

  return rooms;
}

function libraryJson(
  rooms: ReadingRoom[],
  timestamp: string,
  stale = false,
) {
  return NextResponse.json(
    {
      success: true,
      source: LIBRARY_SOURCE,
      data: rooms,
      timestamp,
      stale,
      sourceStatus: stale ? "stale" : "fresh",
    } satisfies LiveDataResponse<ReadingRoom[]>,
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        ...(stale ? { "X-Library-Stale": "1" } : {}),
      },
    },
  );
}
