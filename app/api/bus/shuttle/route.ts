import { NextResponse } from "next/server";
import crypto from "node:crypto";
import http from "node:http";
import type { BusLocation } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const SHUTTLE_LOCATION_URL =
  "http://nexmotion.co.kr/bus/busStatusList.php";
const SHUTTLE_LOCATION_SOURCE = "nexmotion";
const NO_STORE_HEADERS = {
  "Cache-Control":
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
  Pragma: "no-cache",
  Expires: "0",
};

interface ShuttleLocationPayload {
  returnCode?: string;
  data?: unknown[];
}

interface ShuttleLocationFetchResult {
  locations: BusLocation[];
  payload: ShuttleLocationPayload;
  upstreamUrl: string;
}

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

async function fetchShuttleLocations(): Promise<ShuttleLocationFetchResult> {
  const url = new URL(SHUTTLE_LOCATION_URL);
  const payload = await fetchJsonOverHttp(url);

  if (payload.returnCode && payload.returnCode !== "200") {
    throw new Error(`Shuttle location API returned code ${payload.returnCode}`);
  }

  const rows = Array.isArray(payload.data) ? payload.data : [];
  const locations = rows
    .map(toBusLocation)
    .filter((item): item is BusLocation => item !== null)
    .filter((bus) => bus.status !== 0);

  return {
    locations,
    payload,
    upstreamUrl: url.toString(),
  };
}

function fetchJsonOverHttp(url: URL): Promise<ShuttleLocationPayload> {
  return new Promise((resolve, reject) => {
    const phpSessionId = crypto.randomBytes(16).toString("hex");

    const request = http.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 80,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: {
          Accept: "*/*",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          Cookie: `PHPSESSID=${phpSessionId}`,
          "User-Agent": "SYU-CAMPUS/1.0",
        },
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        response.on("end", () => {
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
      },
    );

    request.setTimeout(8000, () => {
      request.destroy(new Error("Shuttle location API request timed out"));
    });
    request.on("error", reject);
    request.end();
  });
}

export async function GET(request: Request) {
  try {
    const { locations, payload, upstreamUrl } =
      await fetchShuttleLocations();
    const timestamp = new Date().toISOString();
    const firstLocation = locations[0];
    const searchParams = new URL(request.url).searchParams;
    const debug = searchParams.get("debug") === "1";
    const raw = searchParams.get("raw") === "1";

    if (raw) {
      return NextResponse.json(payload, {
        headers: {
          ...NO_STORE_HEADERS,
          "X-Shuttle-Source": SHUTTLE_LOCATION_SOURCE,
          "X-Shuttle-Upstream": SHUTTLE_LOCATION_URL,
          "X-Shuttle-Upstream-Url": upstreamUrl,
          "X-Shuttle-Fetched-At": timestamp,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        source: SHUTTLE_LOCATION_SOURCE,
        data: locations,
        ...(debug
          ? {
              debug: {
                upstreamUrl,
                raw: payload,
              },
            }
          : {}),
        timestamp,
      },
      {
        headers: {
          ...NO_STORE_HEADERS,
          "X-Shuttle-Source": SHUTTLE_LOCATION_SOURCE,
          "X-Shuttle-Upstream": SHUTTLE_LOCATION_URL,
          "X-Shuttle-Fetched-At": timestamp,
          "X-Shuttle-First-Location": firstLocation
            ? `${firstLocation.name}:${firstLocation.lat},${firstLocation.lon}`
            : "none",
          "X-Shuttle-Upstream-Url": upstreamUrl,
        },
      },
    );
  } catch (error) {
    console.error("Failed to fetch shuttle bus locations:", error);

    return NextResponse.json(
      {
        success: false,
        source: SHUTTLE_LOCATION_SOURCE,
        error: error instanceof Error ? error.message : "Failed to fetch data",
        data: [],
        timestamp: new Date().toISOString(),
      },
      { status: 502, headers: NO_STORE_HEADERS },
    );
  }
}
