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
import { sortSearchResults } from "./search";
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
}

// 공지사항 API - 크롤링된 실제 데이터 사용
export async function fetchAnnouncements(
  category?: AnnouncementCategory,
): Promise<Announcement[]> {
  try {
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
  } catch (error) {
    throw error;
  }
}

export async function fetchAnnouncementPage({
  category,
  query = "",
  page = 1,
  limit = 10,
}: {
  category?: AnnouncementCategory | "all";
  query?: string;
  page?: number;
  limit?: number;
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
  });
}

export async function fetchAnnouncementSummary(): Promise<Announcement[]> {
  try {
    return await fetchJson<Announcement[]>("/api/announcements/summary", {
      fallback: [],
      noStore: false,
      next: { revalidate: 300 },
      throwOnError: true,
    });
  } catch (error) {
    throw error;
  }
}

export async function fetchCompetitionPage({
  source = "all",
  status = "open",
  query = "",
  page = 1,
  limit = 10,
}: {
  source?: CompetitionSourceFilter;
  status?: CompetitionStatusFilter;
  query?: string;
  page?: number;
  limit?: number;
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
  });
}

// 학식 API - 크롤링된 실제 데이터 사용
export async function fetchCafeteriaMenu(
  date?: string,
): Promise<CafeteriaMenu[]> {
  try {
    const data = await fetchJson<
      Array<{ menus?: unknown[] }> | { menus?: unknown[] }
    >("/api/crawl-data/cafeteria-menu.json", {
      fallback: [],
      throwOnError: true,
    });

    // 데이터 구조 확인
    let cafeteriaData: { menus?: unknown[] };
    if (Array.isArray(data) && data.length > 0) {
      cafeteriaData = data[0];
    } else if (data && typeof data === "object" && "menus" in data) {
      cafeteriaData = data;
    } else {
      throw new Error("Invalid cafeteria data structure");
    }

    if (!cafeteriaData?.menus || !Array.isArray(cafeteriaData.menus)) {
      throw new Error("No cafeteria data");
    }

    // 크롤러 데이터를 CafeteriaMenu 형식으로 변환
    const menus: CafeteriaMenu[] = [];
    const menuDays = cafeteriaData.menus as Array<{
      date: string;
      day: string;
      meals?: {
        breakfast?: string[];
        lunch?: string[] | { a_corner?: string[]; b_corner?: string[] };
        dinner?: string[];
      };
    }>;

    menuDays.forEach((menu, idx) => {
      // 중식 처리 - A/B 코너가 있는 경우와 없는 경우 모두 처리
      const lunch: {
        a?: Array<{ name: string }>;
        b?: Array<{ name: string }>;
      } = {};
      if (menu.meals?.lunch) {
        if (Array.isArray(menu.meals.lunch)) {
          lunch.a = menu.meals.lunch.map((name) => ({ name }));
        } else if (typeof menu.meals.lunch === "object") {
          // A/B 코너가 분리된 경우
          const aCorner =
            (menu.meals.lunch as { a_corner?: string[] }).a_corner || [];
          const bCorner =
            (menu.meals.lunch as { b_corner?: string[] }).b_corner || [];
          lunch.a = aCorner.map((name) => ({ name }));
          lunch.b = bCorner.map((name) => ({ name }));
        }
      }

      const breakfast =
        menu.meals?.breakfast?.map((name) => ({
          name,
        })) || [];
      const dinner = menu.meals?.dinner?.map((name) => ({ name })) || [];

      menus.push({
        id: `cafeteria-${menu.date}-${idx}`,
        date: menu.date,
        dayOfWeek: menu.day || "",
        breakfast: breakfast,
        lunch: lunch,
        dinner: dinner,
        location: "SU-Lounge",
      });
    });

    if (date) {
      return menus.filter((m) => m.date === date);
    }

    return menus;
  } catch (error) {
    throw error;
  }
}

// 학사일정 API - 크롤링된 실제 데이터 사용
export async function fetchAcademicSchedules(
  category?: string,
): Promise<AcademicSchedule[]> {
  try {
    const parsedSchedules = await fetchJson<AcademicSchedule[]>(
      "/data/schedules-major.json",
      { fallback: [], throwOnError: true },
    );

    if (category) {
      return parsedSchedules.filter((s) => s.category === category);
    }
    return parsedSchedules;
  } catch (error) {
    throw error;
  }
}

// 셔틀버스 API - 크롤링된 실제 데이터 사용
export async function fetchShuttleBuses(): Promise<ShuttleBusSchedule[]> {
  try {
    return await fetchJson<ShuttleBusSchedule[]>(
      "/data/shuttle-bus-schedule.json",
      { fallback: [], throwOnError: true },
    );
  } catch (error) {
    throw error;
  }
}

// 셔틀버스 특수 기간 API
export async function fetchShuttleSpecialPeriods(): Promise<ShuttleSpecialPeriods> {
  try {
    return await fetchJson<ShuttleSpecialPeriods>(
      "/data/shuttle-special-periods.json",
      {
        fallback: {
          specialPeriods: [],
          semesterPeriods: [],
          vacationPeriods: [],
        },
        throwOnError: true,
      },
    );
  } catch (error) {
    throw error;
  }
}

// 검색 API - 개선됨 (전체 데이터 통합 검색)
export async function searchAll(
  query: string,
): Promise<(Announcement | AcademicSchedule | PhoneNumber)[]> {
  if (!query.trim()) {
    return [];
  }

  const lowerQuery = query.toLowerCase();

  const settledResults = await Promise.allSettled([
    searchSchedules(lowerQuery),
    searchAnnouncementApi(lowerQuery),
    searchPhoneNumberSource(query, lowerQuery),
  ]);

  const results: SearchAllResult[][] = [];
  settledResults.forEach((result) => {
    if (result.status === "fulfilled") {
      results.push(result.value);
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

  return uniqueResults.slice(0, 100); // 최대 100개로 제한
}

type SearchAllResult =
  | Announcement
  | AcademicSchedule
  | PhoneNumber;

async function searchSchedules(query: string): Promise<AcademicSchedule[]> {
  const schedules = await fetchJson<AcademicSchedule[]>(
    "/data/schedules-major.json",
    { fallback: [], throwOnError: true },
  );

  return schedules.filter(
    (schedule) =>
      includesQuery(schedule.title, query) ||
      includesQuery(schedule.description, query),
  );
}

async function searchAnnouncementApi(query: string): Promise<Announcement[]> {
  const response = await fetchAnnouncementPage({
    category: "all",
    query,
    page: 1,
    limit: 60,
  });

  return response.items;
}

async function searchPhoneNumberSource(
  rawQuery: string,
  lowerQuery: string,
): Promise<PhoneNumber[]> {
  const phoneNumbers = await fetchJson<PhoneNumber[]>(
    "/data/phone-numbers.json",
    {
      fallback: [],
      noStore: false,
      next: { revalidate: 604800 },
      throwOnError: true,
    },
  );

  return phoneNumbers.filter(
    (phone) =>
      includesQuery(phone.department, lowerQuery) ||
      phone.phone?.includes(rawQuery) ||
      includesQuery(phone.description, lowerQuery),
  );
}

function includesQuery(value: string | undefined, query: string): boolean {
  return value?.toLowerCase().includes(query) ?? false;
}

function dedupeSearchResults(results: SearchAllResult[]): SearchAllResult[] {
  return Array.from(
    new Map<string, SearchAllResult>(
      results.map((item) => {
        if ("phone" in item) {
          return [item.phone, item];
        }
        return [item.id, item];
      }),
    ).values(),
  );
}

// 전화번호 API
export async function fetchPhoneNumbers(): Promise<PhoneNumber[]> {
  try {
    return await fetchJson<PhoneNumber[]>("/data/phone-numbers.json", {
      fallback: [],
    });
  } catch {
    return [];
  }
}

// 캠퍼스 꿀팁 자료실
export async function fetchCampusTips(): Promise<CampusTip[]> {
  try {
    return await fetchJson<CampusTip[]>("/data/campus-tips.json", {
      fallback: [],
      noStore: false,
      next: { revalidate: 604800 },
    });
  } catch {
    return [];
  }
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
      headers: {
        Accept: "*/*",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
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

export {
  fetchPublicTransitArrivals,
} from "./public-transit";
