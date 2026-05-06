import { NextResponse } from "next/server";
import type { BusLocation } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHUTTLE_LOCATION_URL = "http://nexmotion.co.kr/bus/busStatusList.php";
const SHUTTLE_CACHE_TTL_MS = 2 * 1000;

let cachedLocations:
  | {
      data: BusLocation[];
      timestamp: string;
      expiresAt: number;
    }
  | undefined;
let pendingLocations: Promise<BusLocation[]> | undefined;

function toBusLocation(item: unknown): BusLocation | null {
  if (!item || typeof item !== "object") return null;

  const record = item as Record<string, unknown>;
  const id = String(record.id ?? record.name ?? "");
  const name = String(record.name ?? id);
  const lat = String(record.lat ?? "");
  const lon = String(record.lon ?? "");
  const status = Number(record.status);
  const routeid = Number(record.routeid);

  if (!id || !Number.isFinite(status) || !Number.isFinite(routeid)) {
    return null;
  }

  return {
    id,
    name,
    lat,
    lon,
    status: status as BusLocation["status"],
    routeid: routeid as BusLocation["routeid"],
  };
}

async function fetchShuttleLocations(): Promise<BusLocation[]> {
  const response = await fetch(SHUTTLE_LOCATION_URL, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "SYU-CAMPUS/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Shuttle location API returned ${response.status}`);
  }

  const text = await response.text();
  const payload = JSON.parse(text) as {
    returnCode?: string;
    data?: unknown[];
  };

  if (payload.returnCode && payload.returnCode !== "200") {
    throw new Error(`Shuttle location API returned code ${payload.returnCode}`);
  }

  const rows = Array.isArray(payload.data) ? payload.data : [];
  return rows
    .map(toBusLocation)
    .filter((item): item is BusLocation => item !== null)
    .filter((bus) => bus.status !== 0);
}

export async function GET() {
  try {
    const now = Date.now();

    if (cachedLocations && cachedLocations.expiresAt > now) {
      return NextResponse.json(
        {
          success: true,
          data: cachedLocations.data,
          timestamp: cachedLocations.timestamp,
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=2, stale-while-revalidate=8",
          },
        },
      );
    }

    pendingLocations ??= fetchShuttleLocations().finally(() => {
      pendingLocations = undefined;
    });

    const locations = await pendingLocations;
    const timestamp = new Date().toISOString();
    cachedLocations = {
      data: locations,
      timestamp,
      expiresAt: Date.now() + SHUTTLE_CACHE_TTL_MS,
    };

    return NextResponse.json(
      {
        success: true,
        data: locations,
        timestamp,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=2, stale-while-revalidate=8",
        },
      },
    );
  } catch (error) {
    console.error("Failed to fetch shuttle bus locations:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch data",
        data: [],
        timestamp: new Date().toISOString(),
      },
      { status: 502 },
    );
  }
}
