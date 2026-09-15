import { NextResponse } from "next/server";

import { normalizeLectureTimetablePayload } from "@/lib/lecture-timetable";
import { requireServerEnv } from "@/lib/server/env";
import type { LectureTimetableDataset } from "@/lib/lecture-timetable";
import { readResponseBytes } from "@/lib/server/read-response-bytes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LECTURE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const LECTURE_REQUEST_TIMEOUT_MS = 20_000;
const LECTURE_RESPONSE_MAX_BYTES = 8 * 1024 * 1024;

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

    if (cachedTimetable) {
      return NextResponse.json(
        {
          success: true,
          data: cachedTimetable.data,
          timestamp: cachedTimetable.timestamp,
          stale: true,
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
          },
        },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "강의 시간표를 불러오지 못했습니다",
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
  const payload = await fetchLectureTimetablePayload(
    requireServerEnv("LECTURE_TIMETABLE_URL"),
  );

  return normalizeLectureTimetablePayload(payload);
}

async function fetchLectureTimetablePayload(url: string): Promise<unknown> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(LECTURE_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Lecture timetable API returned ${response.status}`);
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `Lecture timetable API returned ${contentType || "unknown"} content type`,
    );
  }

  const payload = JSON.parse(
    new TextDecoder().decode(
      await readResponseBytes(
        response,
        LECTURE_RESPONSE_MAX_BYTES,
        "Lecture timetable API",
      ),
    ),
  );
  if (payload == null) {
    throw new Error("Lecture timetable API returned empty payload");
  }

  return payload;
}
