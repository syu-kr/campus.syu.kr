import { NextResponse } from "next/server";
import { fetchPublicTransitArrivals } from "@/lib/api";
import type { BusArrivalsAtStop } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRANSIT_CACHE_TTL_MS = 10 * 1000;
const TRANSIT_STALE_RETENTION_MS = 2 * 60 * 1000;

let cachedArrivals:
  | {
      data: BusArrivalsAtStop[];
      timestamp: string;
      expiresAt: number;
      fallbackUntil: number;
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

    const freshArrivals = await pendingArrivals;
    const arrivals =
      cachedArrivals && cachedArrivals.fallbackUntil > now
        ? preserveMissingRoutes(freshArrivals, cachedArrivals.data)
        : freshArrivals;
    const timestamp = new Date().toISOString();
    const freshRouteCount = countRoutes(freshArrivals);
    const cachedRouteCount = cachedArrivals
      ? countRoutes(cachedArrivals.data)
      : 0;
    cachedArrivals = {
      data: arrivals,
      timestamp,
      expiresAt: Date.now() + TRANSIT_CACHE_TTL_MS,
      fallbackUntil:
        !cachedArrivals || freshRouteCount >= cachedRouteCount
          ? Date.now() + TRANSIT_STALE_RETENTION_MS
          : cachedArrivals.fallbackUntil,
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
        error: "대중교통 도착 정보를 불러오지 못했습니다",
        data: [],
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

function preserveMissingRoutes(
  freshStops: BusArrivalsAtStop[],
  cachedStops: BusArrivalsAtStop[],
) {
  const cachedByStopId = new Map(
    cachedStops.map((item) => [item.stop.id, item]),
  );

  return freshStops.map((freshStop) => {
    const cachedStop = cachedByStopId.get(freshStop.stop.id);

    if (!cachedStop || freshStop.arrivals.length >= cachedStop.arrivals.length) {
      return freshStop;
    }

    const mergedByRoute = new Map(
      cachedStop.arrivals.map((arrival) => [getRouteKey(arrival), arrival]),
    );
    freshStop.arrivals.forEach((arrival) => {
      mergedByRoute.set(getRouteKey(arrival), arrival);
    });

    return {
      ...freshStop,
      arrivals: Array.from(mergedByRoute.values()).sort(compareArrivalTime),
    };
  });
}

function getRouteKey(arrival: BusArrivalsAtStop["arrivals"][number]) {
  return (arrival.routeName || arrival.routeId).replace(/\s+/g, "");
}

function compareArrivalTime(
  first: BusArrivalsAtStop["arrivals"][number],
  second: BusArrivalsAtStop["arrivals"][number],
) {
  return (first.predictTime1 || Infinity) - (second.predictTime1 || Infinity);
}

function countRoutes(stops: BusArrivalsAtStop[]) {
  return stops.reduce((total, item) => total + item.arrivals.length, 0);
}
