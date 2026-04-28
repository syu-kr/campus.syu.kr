import { NextResponse } from "next/server";

import { fetchJson } from "@/lib/fetch-json";
import { normalizeLectureTimetablePayload } from "@/lib/lecture-timetable";
import type { LectureTimetableDataset } from "@/lib/lecture-timetable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LECTURE_TIMETABLE_URL = "https://api.syu.kr/v1/lecture/timetable";
const LECTURE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let cachedTimetable:
  | {
      data: LectureTimetableDataset;
      timestamp: string;
      expiresAt: number;
    }
  | undefined;
let pendingTimetable: Promise<LectureTimetableDataset> | undefined;

export async function GET() {
  try {
    const now = Date.now();

    if (cachedTimetable && cachedTimetable.expiresAt > now) {
      return NextResponse.json(
        {
          success: true,
          data: cachedTimetable.data,
          timestamp: cachedTimetable.timestamp,
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=3600",
          },
        },
      );
    }

    pendingTimetable ??= fetchLectureTimetable().finally(() => {
      pendingTimetable = undefined;
    });

    const timetable = await pendingTimetable;
    const timestamp = new Date().toISOString();
    cachedTimetable = {
      data: timetable,
      timestamp,
      expiresAt: Date.now() + LECTURE_CACHE_TTL_MS,
    };

    return NextResponse.json(
      {
        success: true,
        data: timetable,
        timestamp,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=3600",
        },
      },
    );
  } catch (error) {
    console.error("Failed to fetch lecture timetable:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch data",
        data: {
          courses: [],
        } satisfies LectureTimetableDataset,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

async function fetchLectureTimetable(): Promise<LectureTimetableDataset> {
  const payload = await fetchJson<unknown>(LECTURE_TIMETABLE_URL, {
    fallback: undefined,
    noStore: false,
    next: { revalidate: 60 * 60 * 6 },
    timeoutMs: 20_000,
  });

  return normalizeLectureTimetablePayload(payload);
}
