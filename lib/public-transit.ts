import {
  BusStop,
  BusArrival,
  BusArrivalsAtStop,
} from "@/types";
import type { LiveDataSourceStatus } from "@/types/live-data";
import { fetchJson } from "./fetch-json";
import { requireServerEnv } from "./server/env";
import { getBusRouteDestination } from "./public-transit-destinations";

type GyeonggiArrivalResponse = {
  response?: {
    msgBody?: {
      busArrivalList?: Array<{
        routeName?: string | number;
        routeId?: string | number;
        predictTime1?: number | string;
        predictTime2?: number | string;
        lowPlate1?: number | string;
        lowPlate2?: number | string;
        locationNo1?: number | string;
        locationNo2?: number | string;
        stationId?: string | number;
        stationNm1?: string;
        stationNm2?: string;
        crowded1?: number | string;
        crowded2?: number | string;
      }>;
    };
  };
};

const PUBLIC_TRANSIT_REQUEST_TIMEOUT_MS = 8000;

type PublicTransitSourceFailure = {
  provider: BusStop["region"];
  stopId: string;
  message: string;
};

type GyeonggiArrivalResult = {
  arrivals: BusArrival[];
  partialFailure: boolean;
  failureMessage?: string;
};

export type PublicTransitArrivalsResult = {
  data: BusArrivalsAtStop[];
  stale: boolean;
  sourceStatus: LiveDataSourceStatus;
  error?: string;
  failures: PublicTransitSourceFailure[];
};

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = PUBLIC_TRANSIT_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  if (init.signal) {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// 정류장 설정 (고정)
const PUBLIC_TRANSIT_STOPS: BusStop[] = [
  {
    id: "seoul-jungmun-up",
    name: "삼육대앞",
    region: "seoul",
    seoulArsId: "11154",
    lat: 37.6384167,
    lon: 127.10835,
    direction: "up",
  },
  {
    id: "seoul-jungmun-down",
    name: "삼육대앞",
    region: "seoul",
    seoulArsId: "11155",
    lat: 37.6384167,
    lon: 127.10835,
    direction: "down",
  },
  {
    id: "gyeonggi-jungmun-up",
    name: "삼육대앞",
    region: "gyeonggi",
    gyeonggiStationIds: ["110000054"],
    lat: 37.6384167,
    lon: 127.10835,
    direction: "up",
  },
  {
    id: "gyeonggi-jungmun-down",
    name: "삼육대앞",
    region: "gyeonggi",
    gyeonggiStationIds: ["110000055"],
    lat: 37.6384167,
    lon: 127.10835,
    direction: "down",
  },
  {
    id: "gyeonggi-humun-up",
    name: "삼육대후문",
    region: "gyeonggi",
    gyeonggiStationIds: ["222001596"],
    lat: 37.26,
    lon: 127.03,
    direction: "up",
  },
  {
    id: "gyeonggi-humun-down",
    name: "삼육대후문",
    region: "gyeonggi",
    gyeonggiStationIds: ["222001597"],
    lat: 37.26,
    lon: 127.03,
    direction: "down",
  },
];

function extractKoreanMinutes(message: string): number | undefined {
  const match = message.match(/(\d+)\s*분\s*후/);
  return match ? Number(match[1]) : undefined;
}

function extractStopsBefore(message: string): number | undefined {
  const match = message.match(/\[(\d+)\s*번째\s*전\]/);
  return match ? Number(match[1]) : undefined;
}

function parseSeoulItemTag(item: string, tag: string): string {
  const match = item.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match?.[1]?.trim() ?? "";
}

function hasSamyukName(name: string): boolean {
  const normalized = name.replace(/\s+/g, "");
  return normalized.includes("삼육대");
}

function isFreshSeoulReport(reportTime: string): boolean {
  if (!reportTime) return true;

  const normalized = reportTime.replace(".0", "").trim();
  const parsed = new Date(normalized.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) {
    return true;
  }

  // 서울 API의 오래된 잔존 데이터(과거 연도/과도한 지연)를 제외
  const ageMs = Date.now() - parsed.getTime();
  return ageMs >= 0 && ageMs <= 1000 * 60 * 60 * 3;
}

function normalizeRouteName(name: string): string {
  const compact = name.replace(/\s+/g, "");
  return compact
    .replace(/^(?:남양주|구리)/, "")
    .replace(/(?:남양주|구리)$/, "");
}

export function readTransitNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function getBusRouteKey(
  arrival: Pick<BusArrival, "routeId" | "routeName">,
): string {
  const routeId = String(arrival.routeId ?? "").trim();
  if (routeId) return `id:${routeId}`;

  return `name:${normalizeRouteName(String(arrival.routeName ?? ""))}`;
}

// 서울 버스 도착정보 조회 (정류소 고유번호 arsId 기반)
async function fetchSeoulBusArrivals(
  arsId: string,
  expectedStopName: string,
): Promise<BusArrival[]> {
  try {
    const serviceKey = requireServerEnv("PUBLIC_DATA_SERVICE_KEY");
    const baseUrl = requireServerEnv("SEOUL_BUS_ARRIVAL_URL");

    const params = new URLSearchParams({
      serviceKey,
      arsId,
    });
    const url = `${baseUrl}?${params}`;

    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: { Accept: "application/xml" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Seoul API returned ${response.status}`);
    }

    const text = await response.text();
    const itemRegex = /<itemList>[\s\S]*?<\/itemList>/g;
    const matches = text.match(itemRegex) || [];

    return matches
      .map((item): BusArrival | null => {
        const itemArsId = parseSeoulItemTag(item, "arsId");
        const stopName = parseSeoulItemTag(item, "stNm");
        const reportTime = parseSeoulItemTag(item, "repTm1");

        // 정류장 번호/정류장명(삼육대 포함) 검증
        if (itemArsId !== arsId) {
          return null;
        }

        if (!hasSamyukName(stopName) || !hasSamyukName(expectedStopName)) {
          return null;
        }

        if (!isFreshSeoulReport(reportTime)) {
          return null;
        }

        const routeName = parseSeoulItemTag(item, "rtNm");
        const routeId = parseSeoulItemTag(item, "busRouteId");
        const arrivalMsg1 = parseSeoulItemTag(item, "arrmsg1") || "정보 없음";
        const arrivalMsg2 = parseSeoulItemTag(item, "arrmsg2") || "운행 종료";

        if (!routeName) {
          return null;
        }

        return {
          routeId,
          routeName: normalizeRouteName(routeName),
          arrivalMsg1,
          arrivalMsg2,
          isLow1: false,
          isLow2: false,
          locationNo1: extractStopsBefore(arrivalMsg1),
          locationNo2: extractStopsBefore(arrivalMsg2),
          nextStation1: parseSeoulItemTag(item, "nxtStn") || undefined,
          nextStation2: parseSeoulItemTag(item, "nxtStn") || undefined,
          predictTime1: extractKoreanMinutes(arrivalMsg1),
          predictTime2: extractKoreanMinutes(arrivalMsg2),
        };
      })
      .filter((item): item is BusArrival => item !== null);
  } catch (error) {
    console.error("Failed to fetch Seoul bus arrivals:", error);
    throw error;
  }
}

// 경기도 버스 도착정보 조회
async function fetchGyeonggiBusArrivals(
  stationIds: string[],
  expectedStopName: string,
): Promise<GyeonggiArrivalResult> {
  try {
    const serviceKey = requireServerEnv("PUBLIC_DATA_SERVICE_KEY");
    const baseUrl = requireServerEnv("GYEONGGI_BUS_ARRIVAL_URL");

    // 각 stationId에 대해 병렬 조회
    const promises = stationIds.map(async (stationId: string) => {
      try {
        const params = new URLSearchParams({
          serviceKey,
          stationId,
          format: "json",
        });
        const url = `${baseUrl}?${params}`;

        const data = await fetchJson<GyeonggiArrivalResponse>(url, {
          fallback: {},
          timeoutMs: PUBLIC_TRANSIT_REQUEST_TIMEOUT_MS,
        });

        const items = data.response?.msgBody?.busArrivalList || [];

        const arrivals = items
          .filter((item) => {
            const itemStationId = String(item.stationId ?? "");
            // 정류장 번호/정류장명(삼육대 포함) 검증
            return (
              stationId === itemStationId && hasSamyukName(expectedStopName)
            );
          })
          .map((item) => {
            const predictTime1 = readTransitNumber(item.predictTime1);
            const predictTime2 = readTransitNumber(item.predictTime2);
            const lowPlate1 = readTransitNumber(item.lowPlate1);
            const lowPlate2 = readTransitNumber(item.lowPlate2);
            const locationNo1 = readTransitNumber(item.locationNo1);
            const locationNo2 = readTransitNumber(item.locationNo2);
            const crowded1 = readTransitNumber(item.crowded1);
            const crowded2 = readTransitNumber(item.crowded2);

            // predictTime은 이미 분 단위 (API 문서: 초 단위라 했으나 실제는 분 단위)
            const time1 =
              predictTime1 !== undefined
                ? Math.ceil(predictTime1) + "분"
                : "정보 없음";
            const time2 =
              predictTime2 !== undefined
                ? Math.ceil(predictTime2) + "분"
                : "운행 종료";

            return {
              routeId: String(item.routeId ?? "").trim(),
              routeName: normalizeRouteName(String(item.routeName ?? "")),
              arrivalMsg1: time1,
              arrivalMsg2: time2,
              isLow1: lowPlate1 === 1,
              isLow2: lowPlate2 === 1,
              locationNo1,
              locationNo2,
              nextStation1: item.stationNm1,
              nextStation2: item.stationNm2,
              predictTime1,
              predictTime2,
              crowded1,
              crowded2,
            };
          }) as BusArrival[];

        return { arrivals, failed: false };
      } catch (error) {
        console.error(
          `Failed to fetch Gyeonggi bus arrivals for station ${stationId}:`,
          error,
        );
        return { arrivals: [] as BusArrival[], failed: true };
      }
    });

    const results = await Promise.all(promises);
    const failedRequests = results.filter((result) => result.failed).length;

    if (failedRequests === results.length && results.length > 0) {
      throw new Error("All Gyeonggi station arrival requests failed");
    }

    // 모든 결과 병합 및 중복 제거
    const routeMap = new Map<string, BusArrival>();

    results.forEach((batch) => {
      batch.arrivals.forEach((arrival) => {
        const key = getBusRouteKey(arrival);
        if (!routeMap.has(key)) {
          routeMap.set(key, arrival);
        }
      });
    });

    return {
      arrivals: Array.from(routeMap.values()),
      partialFailure: failedRequests > 0,
      failureMessage:
        failedRequests > 0
          ? "Some Gyeonggi station arrival requests failed"
          : undefined,
    };
  } catch (error) {
    console.error("Failed to fetch Gyeonggi bus arrivals:", error);
    throw error;
  }
}

// 대중교통 도착 정보 통합 조회 (모든 정류장)
export async function fetchPublicTransitArrivals(): Promise<PublicTransitArrivalsResult> {
  const results: BusArrivalsAtStop[] = [];
  const stopMap = new Map<string, BusArrivalsAtStop>();
  const failures: PublicTransitSourceFailure[] = [];
  let attemptedFetches = 0;

  // 병렬로 모든 정류장의 도착정보 조회
  const promises = PUBLIC_TRANSIT_STOPS.map(async (stop) => {
    let arrivals: BusArrival[] = [];
    let provider: BusStop["region"] = stop.region;

    try {
      if (stop.region === "seoul" && stop.seoulArsId) {
        attemptedFetches += 1;
        provider = "seoul";
        arrivals = await fetchSeoulBusArrivals(stop.seoulArsId, stop.name);
      } else if (
        stop.region === "gyeonggi" &&
        stop.gyeonggiStationIds &&
        stop.gyeonggiStationIds.length > 0
      ) {
        attemptedFetches += 1;
        provider = "gyeonggi";
        const result = await fetchGyeonggiBusArrivals(
          stop.gyeonggiStationIds,
          stop.name,
        );
        arrivals = result.arrivals;
        if (result.partialFailure) {
          failures.push({
            provider,
            stopId: stop.id,
            message:
              result.failureMessage ??
              "Some Gyeonggi station arrival requests failed",
          });
        }
      }
    } catch (error) {
      failures.push({
        provider,
        stopId: stop.id,
        message:
          error instanceof Error
            ? error.message
            : "Unknown public transit source failure",
      });
    }

    // noLine 또는 빈 응답 제거
    arrivals = arrivals.filter((a) => a.routeName && a.routeName !== "noLine");

    // 위치/방향 기반 통합 키 생성 (같은 위치의 서울/경기도 합치기)
    const locationPrefix = stop.id.includes("jungmun")
      ? "jungmun"
      : stop.id.includes("humun")
        ? "humun"
        : "unknown";
    const mergeKey = `${locationPrefix}-${stop.direction}`;

    if (stopMap.has(mergeKey)) {
      // 이미 이 방향의 데이터가 있으면 arrivals 병합
      const existing = stopMap.get(mergeKey)!;
      const mergedByRoute = new Map<string, BusArrival>();

      [...existing.arrivals, ...arrivals].forEach((arrival) => {
        const key = getBusRouteKey(arrival);
        const prev = mergedByRoute.get(key);

        if (!prev) {
          mergedByRoute.set(key, arrival);
          return;
        }

        const prevTime =
          typeof prev.predictTime1 === "number" ? prev.predictTime1 : Infinity;
        const nextTime =
          typeof arrival.predictTime1 === "number"
            ? arrival.predictTime1
            : Infinity;

        // 동일 노선이 여러 소스에서 오면 도착예정이 있는 값, 그리고 더 이른 값을 우선 사용
        if (
          nextTime < prevTime ||
          (nextTime === prevTime &&
            arrival.routeName.length < prev.routeName.length)
        ) {
          mergedByRoute.set(key, arrival);
        }
      });

      existing.arrivals = Array.from(mergedByRoute.values());
      existing.lastUpdated = new Date();
    } else {
      // 새로운 방향 데이터
      stopMap.set(mergeKey, {
        stop: {
          ...stop,
          // 이름을 위치+방향으로 통일 (서울/경기도 구분 제거)
          id: mergeKey,
        },
        arrivals,
        lastUpdated: new Date(),
      });
    }
  });

  await Promise.all(promises);

  if (attemptedFetches > 0 && failures.length === attemptedFetches) {
    throw new Error("All public transit arrival sources failed");
  }

  // 맵의 값들을 배열로 변환
  Array.from(stopMap.values()).forEach((item) => {
    item.arrivals = item.arrivals.map((arrival) => ({
      ...arrival,
      destination: getBusRouteDestination(item.stop.id, arrival.routeId),
    }));

    // 도착 시간순으로 정렬
    item.arrivals.sort((a, b) => {
      const timeA = a.predictTime1 || Infinity;
      const timeB = b.predictTime1 || Infinity;
      return timeA - timeB;
    });
    results.push(item);
  });

  return {
    data: results,
    stale: failures.length > 0,
    sourceStatus: failures.length > 0 ? "stale" : "fresh",
    error:
      failures.length > 0
        ? "일부 대중교통 도착 정보 제공처를 조회하지 못했습니다."
        : undefined,
    failures,
  };
}
