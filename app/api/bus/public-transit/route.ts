import { NextResponse } from "next/server";
import { fetchPublicTransitArrivals } from "@/lib/api";
import type { PublicTransitArrivalsResult } from "@/lib/public-transit";
import type { BusArrivalsAtStop } from "@/types";
import { resolveTransitTimestamp } from "@/lib/server/transit-cache";
import type {
  LiveDataResponse,
  LiveDataSourceStatus,
} from "@/types/live-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRANSIT_CACHE_TTL_MS = 10 * 1000;
const TRANSIT_STALE_RETENTION_MS = 2 * 60 * 1000;
const TRANSIT_SOURCE = "public-transit-arrivals";

let cachedArrivals:
  | {
      data: BusArrivalsAtStop[];
      timestamp: string;
      stale: boolean;
      sourceStatus: LiveDataSourceStatus;
      error?: string;
      expiresAt: number;
      fallbackUntil: number;
    }
  | undefined;
let pendingArrivals: Promise<PublicTransitArrivalsResult> | undefined;

export async function GET() {
  const now = Date.now();

  try {
    if (cachedArrivals && cachedArrivals.expiresAt > now) {
      return NextResponse.json(
        {
          success: true,
          source: TRANSIT_SOURCE,
          data: cachedArrivals.data,
          timestamp: cachedArrivals.timestamp,
          stale: cachedArrivals.stale,
          sourceStatus: cachedArrivals.sourceStatus,
          error: cachedArrivals.error,
        } satisfies LiveDataResponse<BusArrivalsAtStop[]>,
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

    const freshTransit = await pendingArrivals;
    const freshArrivals = freshTransit.data;
    const freshRouteCount = countRoutes(freshArrivals);
    const cachedRouteCount = cachedArrivals
      ? countRoutes(cachedArrivals.data)
      : 0;
    const usedRouteFallback =
      Boolean(cachedArrivals && cachedArrivals.fallbackUntil > now) &&
      freshRouteCount < cachedRouteCount;
    const arrivals =
      usedRouteFallback && cachedArrivals
        ? preserveMissingRoutes(freshArrivals, cachedArrivals.data)
        : freshArrivals;
    // 일부 노선을 이전 캐시에서 보존했다면 전체 응답을 새 데이터처럼 표시하지 않는다.
    const timestamp = resolveTransitTimestamp(
      usedRouteFallback,
      cachedArrivals?.timestamp,
      new Date().toISOString(),
    );
    const stale = usedRouteFallback || freshTransit.stale;
    const sourceStatus: LiveDataSourceStatus = stale
      ? "stale"
      : freshTransit.sourceStatus;
    cachedArrivals = {
      data: arrivals,
      timestamp,
      stale,
      sourceStatus,
      error: freshTransit.error,
      expiresAt: Date.now() + TRANSIT_CACHE_TTL_MS,
      fallbackUntil:
        !cachedArrivals || freshRouteCount >= cachedRouteCount
          ? Date.now() + TRANSIT_STALE_RETENTION_MS
          : cachedArrivals.fallbackUntil,
    };

    return NextResponse.json(
      {
        success: true,
        source: TRANSIT_SOURCE,
        data: arrivals,
        timestamp,
        stale,
        sourceStatus,
        error: freshTransit.error,
      } satisfies LiveDataResponse<BusArrivalsAtStop[]>,
      {
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20",
        },
      },
    );
  } catch (error) {
    console.error("Failed to fetch public transit arrivals:", error);

    if (cachedArrivals && cachedArrivals.fallbackUntil > now) {
      return NextResponse.json(
        {
          success: true,
          source: TRANSIT_SOURCE,
          data: cachedArrivals.data,
          timestamp: cachedArrivals.timestamp,
          stale: true,
          sourceStatus: "stale",
          error: cachedArrivals.error,
        } satisfies LiveDataResponse<BusArrivalsAtStop[]>,
        {
          headers: {
            "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20",
          },
        },
      );
    }

    return NextResponse.json(
      {
        success: false,
        source: TRANSIT_SOURCE,
        error: "대중교통 도착 정보를 불러오지 못했습니다",
        data: [],
        timestamp: new Date().toISOString(),
        stale: false,
        sourceStatus: "error",
      } satisfies LiveDataResponse<BusArrivalsAtStop[]>,
      { status: 502 },
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
