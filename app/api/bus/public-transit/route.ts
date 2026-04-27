import { NextResponse } from "next/server";
import { fetchPublicTransitArrivals } from "@/lib/api";
import type { BusArrivalsAtStop } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRANSIT_CACHE_TTL_MS = 10 * 1000;

let cachedArrivals:
  | {
      data: BusArrivalsAtStop[];
      timestamp: string;
      expiresAt: number;
    }
  | undefined;
let pendingArrivals: Promise<BusArrivalsAtStop[]> | undefined;

export async function GET() {
  try {
    const now = Date.now();

    if (cachedArrivals && cachedArrivals.expiresAt > now) {
      return NextResponse.json(
        {
          success: true,
          data: cachedArrivals.data,
          timestamp: cachedArrivals.timestamp,
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20",
          },
        },
      );
    }

    // 서울 2개, 경기 4개 정류장 도착 정보를 병렬 조회한다.
    pendingArrivals ??= fetchPublicTransitArrivals().finally(() => {
      pendingArrivals = undefined;
    });

    const arrivals = await pendingArrivals;
    const timestamp = new Date().toISOString();
    cachedArrivals = {
      data: arrivals,
      timestamp,
      expiresAt: Date.now() + TRANSIT_CACHE_TTL_MS,
    };

    return NextResponse.json(
      {
        success: true,
        data: arrivals,
        timestamp,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20",
        },
      },
    );
  } catch (error) {
    console.error("Failed to fetch public transit arrivals:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch data",
        data: [],
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
