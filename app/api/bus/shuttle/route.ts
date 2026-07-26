import { NextResponse } from "next/server";
import https from "node:https";
import type { BusLocation } from "@/types";
import { requireServerEnv } from "@/lib/server/env";
import { toBusLocation } from "@/lib/shuttle-location";
import {
  MAX_SHUTTLE_RESPONSE_BYTES,
  validateShuttleEndpoint,
} from "@/lib/server/shuttle-upstream";
import type { LiveDataResponse } from "@/types/live-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const SHUTTLE_LOCATION_SOURCE = "shuttle";
const SHUTTLE_CACHE_TTL_MS = 3 * 1000;
const SHUTTLE_STALE_RETENTION_MS = 60 * 1000;
const MAX_SHUTTLE_ROWS = 100;
const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3, stale-while-revalidate=10",
};
let cachedLocations:
  | {
      locations: BusLocation[];
      timestamp: string;
      fetchedAt: number;
      expiresAt: number;
    }
  | undefined;
let pendingLocations: Promise<BusLocation[]> | undefined;

interface ShuttleLocationPayload {
  returnCode?: string;
  data?: unknown[];
}

async function fetchShuttleLocations(): Promise<BusLocation[]> {
  const { url, referer } = validateShuttleEndpoint(
    requireServerEnv("SHUTTLE_LOCATION_URL"),
    requireServerEnv("SHUTTLE_REFERER"),
  );
  const payload = await fetchJsonFromUrl(url, referer);

  if (payload.returnCode && payload.returnCode !== "200") {
    throw new Error(`Shuttle location API returned code ${payload.returnCode}`);
  }

  const rows = Array.isArray(payload.data) ? payload.data : [];
  if (rows.length > MAX_SHUTTLE_ROWS) {
    throw new Error("Shuttle location API returned too many rows");
  }

  const locations = rows
    .map(toBusLocation)
    .filter((item): item is BusLocation => item !== null)
    .filter((bus) => bus.status !== 0);

  if (rows.length > 0 && locations.length === 0) {
    throw new Error("Shuttle location API returned no valid locations");
  }

  return locations;
}

function fetchJsonFromUrl(
  url: URL,
  referer: string,
): Promise<ShuttleLocationPayload> {
  const userAgent = requireServerEnv("SHUTTLE_USER_AGENT");

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: {
          Accept: "*/*",
          "Accept-Language": "ko,en;q=0.9,en-US;q=0.8",
          "Cache-Control": "no-cache",
          DNT: "1",
          Pragma: "no-cache",
          Priority: "u=1, i",
          Referer: referer,
          "Sec-CH-UA":
            '"Chromium";v="148", "Microsoft Edge";v="148", "Not/A)Brand";v="99"',
          "Sec-CH-UA-Mobile": "?0",
          "Sec-CH-UA-Platform": '"Windows"',
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
          "User-Agent": userAgent,
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let receivedBytes = 0;
        let responseRejected = false;

        response.on("data", (chunk) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          receivedBytes += buffer.byteLength;

          if (receivedBytes > MAX_SHUTTLE_RESPONSE_BYTES) {
            responseRejected = true;
            response.destroy();
            reject(new Error("Shuttle location API response is too large"));
            return;
          }

          chunks.push(buffer);
        });

        response.on("end", () => {
          if (responseRejected) return;

          const statusCode = response.statusCode ?? 0;
          const body = Buffer.concat(chunks).toString("utf8");

          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`Shuttle location API returned ${statusCode}`));
            return;
          }

          try {
            resolve(JSON.parse(body) as ShuttleLocationPayload);
          } catch {
            reject(new Error("Shuttle location API returned invalid JSON"));
          }
        });
        response.on("error", (error) => {
          if (!responseRejected) reject(error);
        });
      },
    );

    request.setTimeout(8000, () => {
      request.destroy(new Error("Shuttle location API request timed out"));
    });
    request.on("error", reject);
    request.end();
  });
}

export async function GET() {
  const now = Date.now();

  try {
    if (cachedLocations && cachedLocations.expiresAt > now) {
      return shuttleJson(cachedLocations.locations, cachedLocations.timestamp);
    }

    pendingLocations ??= fetchShuttleLocations().finally(() => {
      pendingLocations = undefined;
    });

    const locations = await pendingLocations;
    const timestamp = new Date().toISOString();
    cachedLocations = {
      locations,
      timestamp,
      fetchedAt: Date.now(),
      expiresAt: Date.now() + SHUTTLE_CACHE_TTL_MS,
    };

    return shuttleJson(locations, timestamp);
  } catch (error) {
    console.error("Failed to fetch shuttle bus locations:", error);

    if (
      cachedLocations &&
      cachedLocations.fetchedAt + SHUTTLE_STALE_RETENTION_MS > now
    ) {
      return shuttleJson(
        cachedLocations.locations,
        cachedLocations.timestamp,
        true,
      );
    }

    return NextResponse.json(
      {
        success: false,
        source: SHUTTLE_LOCATION_SOURCE,
        error: "셔틀 위치 정보를 불러오지 못했습니다",
        data: [],
        timestamp: new Date().toISOString(),
        stale: false,
        sourceStatus: "error",
      } satisfies LiveDataResponse<BusLocation[]>,
      {
        status: 502,
        headers: PUBLIC_CACHE_HEADERS,
      },
    );
  }
}

function shuttleJson(
  locations: BusLocation[],
  timestamp: string,
  stale = false,
) {
  return NextResponse.json(
    {
      success: true,
      source: SHUTTLE_LOCATION_SOURCE,
      data: locations,
      timestamp,
      stale,
      sourceStatus: stale ? "stale" : "fresh",
    } satisfies LiveDataResponse<BusLocation[]>,
    {
      headers: {
        ...PUBLIC_CACHE_HEADERS,
        "X-Shuttle-Source": SHUTTLE_LOCATION_SOURCE,
        "X-Shuttle-Fetched-At": timestamp,
        ...(stale ? { "X-Shuttle-Stale": "1" } : {}),
      },
    },
  );
}
