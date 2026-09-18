import { NextResponse } from "next/server";
import http from "node:http";
import https from "node:https";
import type { BusLocation } from "@/types";
import { requireServerEnv } from "@/lib/server/env";
import { toBusLocation } from "@/lib/shuttle-location";
import {
  createShuttleChallengeBody,
  MAX_SHUTTLE_RESPONSE_BYTES,
  validateShuttleEndpoint,
} from "@/lib/server/shuttle-upstream";
import type { LiveDataResponse } from "@/types/live-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const SHUTTLE_LOCATION_SOURCE = "shuttle";
const SHUTTLE_CACHE_TTL_MS = 30 * 1000;
const SHUTTLE_STALE_RETENTION_MS = 10 * 60 * 1000;
const SHUTTLE_FORBIDDEN_COOLDOWN_MS = 5 * 60 * 1000;
const SHUTTLE_REQUEST_TIMEOUT_MS = 3500;
const MAX_SHUTTLE_ROWS = 100;
const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
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
// ponytail: 인스턴스 로컬 cooldown; 분산 차단이 필요해질 때 공유 저장소로 승격.
let upstreamBlockedUntil = 0;

interface ShuttleLocationPayload {
  returnCode?: string;
  data?: unknown[];
}

async function fetchShuttleLocations(): Promise<BusLocation[]> {
  if (Date.now() < upstreamBlockedUntil) {
    throw new Error("Shuttle location API cooldown is active");
  }

  const { url, referer, pageUrl } = validateShuttleEndpoint(
    requireServerEnv("SHUTTLE_LOCATION_URL"),
    requireServerEnv("SHUTTLE_REFERER"),
    requireServerEnv("SHUTTLE_PAGE_URL"),
  );
  const userAgent = requireServerEnv("SHUTTLE_USER_AGENT");
  let payload: ShuttleLocationPayload;

  try {
    const challengeHtml = await fetchTextFromUrl(pageUrl, {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko,en-US;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Upgrade-Insecure-Requests": "1",
        "User-Agent": userAgent,
      },
    });
    const body = createShuttleChallengeBody(
      challengeHtml,
      requireServerEnv("SHUTTLE_CHALLENGE_SALT"),
    );
    const responseBody = await fetchTextFromUrl(url, {
      method: "POST",
      body,
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "ko,en-US;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        "Content-Length": Buffer.byteLength(body),
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Origin: url.origin,
        Pragma: "no-cache",
        Referer: referer,
        "User-Agent": userAgent,
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    try {
      payload = JSON.parse(responseBody) as ShuttleLocationPayload;
    } catch {
      throw new Error("Shuttle location API returned invalid JSON");
    }
  } catch (error) {
    if (getUpstreamStatusCode(error) === 403) {
      upstreamBlockedUntil = Date.now() + SHUTTLE_FORBIDDEN_COOLDOWN_MS;
    }
    throw error;
  }

  upstreamBlockedUntil = 0;

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

function fetchTextFromUrl(
  url: URL,
  options: {
    method?: "GET" | "POST";
    headers: Record<string, string | number>;
    body?: string;
  },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: options.method ?? "GET",
        headers: options.headers,
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
            const error = new Error(
              `Shuttle location API returned ${statusCode}`,
            ) as Error & { statusCode: number };
            error.statusCode = statusCode;
            reject(error);
            return;
          }

          resolve(body);
        });
        response.on("error", (error) => {
          if (!responseRejected) reject(error);
        });
      },
    );

    request.setTimeout(SHUTTLE_REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error("Shuttle location API request timed out"));
    });
    request.on("error", reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}

function getUpstreamStatusCode(error: unknown): number | undefined {
  return error instanceof Error && "statusCode" in error
    ? Number(error.statusCode)
    : undefined;
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
