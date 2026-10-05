import {
  Announcement,
  AnnouncementCategory,
  CafeteriaMenu,
  AcademicSchedule,
  ShuttleBusSchedule,
  ShuttleSpecialPeriods,
  BusLocation,
  CampusTip,
  CompetitionPageResponse,
  CompetitionSourceFilter,
  CompetitionStatusFilter,
  PhoneNumber,
} from "@/types";
import { fetchJson } from "./fetch-json";
import { toCafeteriaMenus, type CafeteriaMenuDay } from "./cafeteria";
import { toBusLocation } from "./shuttle-location";
import { sortSearchResults } from "./search";
import { matchesPhoneQuery } from "./phone";
import { emptyPublicHolidays, parsePublicHolidaySnapshot } from "./public-holidays";
import type {
  LiveDataResponse,
  LiveDataSourceStatus,
} from "@/types/live-data";

export interface AnnouncementPageResponse {
  items: Announcement[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  fallbackSources?: { category: AnnouncementCategory; latestDate: string }[];
}

// 공지사항 API - 크롤링된 실제 데이터 사용
export async function fetchAnnouncements(
  category?: AnnouncementCategory,
): Promise<Announcement[]> {
  const params = new URLSearchParams({
    category: category || "all",
    page: "1",
    limit: "100",
  });
  const response = await fetchJson<AnnouncementPageResponse>(
    `/api/announcements?${params}`,
    {
      fallback: {
        items: [],
        total: 0,
        page: 1,
        limit: 100,
        totalPages: 1,
      },
      throwOnError: true,
    },
  );
  return response.items;
}

export async function fetchAnnouncementPage({
  category,
  query = "",
  page = 1,
  limit = 10,
  signal,
}: {
  category?: AnnouncementCategory | "all";
  query?: string;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}): Promise<AnnouncementPageResponse> {
  const params = new URLSearchParams({
    category: category || "all",
    query,
    page: String(page),
    limit: String(limit),
  });

  return fetchJson<AnnouncementPageResponse>(`/api/announcements?${params}`, {
    fallback: {
      items: [],
      total: 0,
      page,
      limit,
      totalPages: 1,
    },
    noStore: Boolean(query),
    throwOnError: true,
    signal,
  });
}

export async function fetchAnnouncementSummary(): Promise<Announcement[]> {
  return fetchJson<Announcement[]>("/api/announcements/summary", {
    fallback: [],
    noStore: false,
    throwOnError: true,
  });
}

export async function fetchCompetitionPage({
  source = "all",
  status = "open",
  query = "",
  page = 1,
  limit = 10,
  signal,
}: {
  source?: CompetitionSourceFilter;
  status?: CompetitionStatusFilter;
  query?: string;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}): Promise<CompetitionPageResponse> {
  const params = new URLSearchParams({
    source,
    status,
    query,
    page: String(page),
    limit: String(limit),
  });

  return fetchJson<CompetitionPageResponse>(`/api/competitions?${params}`, {
    fallback: {
      items: [],
      total: 0,
      page,
      limit,
      totalPages: 1,
    },
    noStore: Boolean(query),
    throwOnError: true,
    signal,
  });
}

// 학식 API - 크롤링된 실제 데이터 사용
export async function fetchCafeteriaMenu(
  date?: string,
): Promise<CafeteriaMenu[]> {
  const data = await fetchJson<
    Array<{ menus?: CafeteriaMenuDay[] }> | { menus?: CafeteriaMenuDay[] }
  >("/api/crawl-data/cafeteria-menu.json", {
    fallback: [],
    throwOnError: true,
  });
  const cafeteriaData = Array.isArray(data) ? data[0] : data;
  const hasSource = Array.isArray(data)
    ? data.length > 0
    : data && typeof data === "object" && "menus" in data;
  if (!hasSource) {
    throw new Error("Invalid cafeteria data structure");
  }
  if (!Array.isArray(cafeteriaData?.menus)) throw new Error("No cafeteria data");
  const menus = toCafeteriaMenus(cafeteriaData.menus);
  return date ? menus.filter((menu) => menu.date === date) : menus;
}

// 공휴일 API - 검증된 Pages 데이터 사용
export async function fetchPublicHolidays() {
  return parsePublicHolidaySnapshot(await fetchJson<unknown>("/api/crawl-data/public-holidays.json", {
    fallback: emptyPublicHolidays(), throwOnError: true, timeoutMs: 12_000,
  }));
}

// 학사일정 API - 크롤링된 실제 데이터 사용
export async function fetchAcademicSchedules(
  category?: string,
): Promise<AcademicSchedule[]> {
  const parsedSchedules = await fetchJson<AcademicSchedule[]>(
    "/data/schedules-major.json",
    { fallback: [], throwOnError: true },
  );

  if (category) {
    return parsedSchedules.filter((s) => s.category === category);
  }
  return parsedSchedules;
}

// 셔틀버스 API - 크롤링된 실제 데이터 사용
export async function fetchShuttleBuses(): Promise<ShuttleBusSchedule[]> {
  return fetchJson<ShuttleBusSchedule[]>("/data/shuttle-bus-schedule.json", {
    fallback: [],
    throwOnError: true,
  });
}

// 셔틀버스 특수 기간 API
export async function fetchShuttleSpecialPeriods(): Promise<ShuttleSpecialPeriods> {
  return fetchJson<ShuttleSpecialPeriods>("/data/shuttle-special-periods.json", {
    fallback: {
      specialPeriods: [],
      semesterPeriods: [],
      vacationPeriods: [],
    },
    throwOnError: true,
  });
}

export type SearchSource = "schedules" | "announcements" | "phone";

export interface SearchAllResponse {
  items: SearchAllResult[];
  failedSources: SearchSource[];
}

// 검색 API - 일정, 공지, 연락처 미리보기
export async function searchAll(
  query: string,
  signal?: AbortSignal,
): Promise<SearchAllResponse> {
  signal?.throwIfAborted();
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return { items: [], failedSources: [] };

  const lowerQuery = normalizedQuery.toLowerCase();

  const settledResults = await Promise.allSettled([
    searchSchedules(lowerQuery, signal),
    searchAnnouncementApi(lowerQuery, signal),
    searchPhoneNumberSource(normalizedQuery, signal),
  ]);
  signal?.throwIfAborted();

  const results: SearchAllResult[][] = [];
  const failedSources: SearchSource[] = [];
  const sources: SearchSource[] = ["schedules", "announcements", "phone"];
  settledResults.forEach((result, index) => {
    if (result.status === "fulfilled") {
      results.push(result.value);
    } else {
      failedSources.push(sources[index]);
    }
  });

  if (results.length === 0) {
    const firstFailure = settledResults.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    throw firstFailure?.reason ?? new Error("검색 정보를 불러오지 못했습니다.");
  }

  const uniqueResults = sortSearchResults(
    dedupeSearchResults(results.flat()),
    query,
  );

  return { items: uniqueResults.slice(0, 100), failedSources };
}

type SearchAllResult =
  | Announcement
  | AcademicSchedule
  | PhoneNumber;

async function searchSchedules(query: string, signal?: AbortSignal): Promise<AcademicSchedule[]> {
  const schedules = await fetchJson<AcademicSchedule[]>(
    "/data/schedules-major.json",
    { fallback: [], throwOnError: true, signal },
  );

  return schedules.filter(
    (schedule) =>
      includesQuery(schedule.title, query) ||
      includesQuery(schedule.description, query),
  );
}

async function searchAnnouncementApi(query: string, signal?: AbortSignal): Promise<Announcement[]> {
  const response = await fetchAnnouncementPage({
    category: "all",
    query,
    page: 1,
    limit: 60,
    signal,
  });

  return response.items;
}

async function searchPhoneNumberSource(
  rawQuery: string,
  signal?: AbortSignal,
): Promise<PhoneNumber[]> {
  const phoneNumbers = await fetchJson<PhoneNumber[]>(
    "/data/phone-numbers.json",
    {
      fallback: [],
      noStore: false,
      throwOnError: true,
      signal,
    },
  );

  return phoneNumbers.filter((phone) => matchesPhoneQuery(phone, rawQuery));
}

function includesQuery(value: string | undefined, query: string): boolean {
  return value?.toLowerCase().includes(query) ?? false;
}

function dedupeSearchResults(results: SearchAllResult[]): SearchAllResult[] {
  return Array.from(
    new Map<string, SearchAllResult>(
      results.map((item) => {
        if ("phone" in item) {
          return [`phone:${item.department}:${item.phone}`, item];
        }
        return [item.id, item];
      }),
    ).values(),
  );
}

// 전화번호 API
export async function fetchPhoneNumbers(): Promise<PhoneNumber[]> {
  return fetchJson<PhoneNumber[]>("/data/phone-numbers.json", {
    fallback: [],
    throwOnError: true,
  });
}

// 캠퍼스 꿀팁 자료실
export async function fetchCampusTips(): Promise<CampusTip[]> {
  return fetchJson<CampusTip[]>("/data/campus-tips.json", {
    fallback: [],
    noStore: false,
    throwOnError: true,
  });
}

// 버스 실시간 위치 API
interface RawShuttleLocationPayload {
  success?: boolean;
  source?: string;
  data?: unknown[];
  timestamp?: string;
  stale?: boolean;
  sourceStatus?: LiveDataSourceStatus;
  error?: string;
}

function isLiveDataSourceStatus(value: unknown): value is LiveDataSourceStatus {
  return value === "fresh" || value === "stale" || value === "error";
}

export async function fetchBusLocationStatus(): Promise<
  LiveDataResponse<BusLocation[]>
> {
  const response = await fetchJson<RawShuttleLocationPayload>(
    "/api/bus/shuttle",
    {
      fallback: {
        success: false,
        source: "shuttle",
        data: [],
        timestamp: new Date().toISOString(),
        stale: false,
        sourceStatus: "error",
      },
      method: "GET",
      credentials: "same-origin",
      noStore: false,
      cache: "default",
      headers: {
        Accept: "*/*",
      },
      timeoutMs: 8000,
    },
  );

  if (!response.success) {
    throw new Error(response.error ?? "셔틀 위치 정보를 불러오지 못했습니다.");
  }

  const locations = (Array.isArray(response.data) ? response.data : [])
    .map(toBusLocation)
    .filter((item): item is BusLocation => item !== null)
    .filter((bus) => bus.status !== 0);

  const stale = Boolean(response.stale);

  return {
    success: true,
    source: typeof response.source === "string" ? response.source : "shuttle",
    data: locations,
    timestamp:
      typeof response.timestamp === "string"
        ? response.timestamp
        : new Date().toISOString(),
    stale,
    sourceStatus: isLiveDataSourceStatus(response.sourceStatus)
      ? response.sourceStatus
      : stale
        ? "stale"
        : "fresh",
  };
}
