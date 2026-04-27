import {
  Announcement,
  CafeteriaMenu,
  AcademicSchedule,
  ShuttleBusSchedule,
  ShuttleSpecialPeriods,
  BusLocation,
  CampusTip,
  Scholarship,
  PhoneNumber,
} from "@/types";
import { fetchJson } from "./fetch-json";
import { sortSearchResults } from "./search";

// 공지사항 API - 크롤링된 실제 데이터 사용
export async function fetchAnnouncements(
  category?: string,
): Promise<Announcement[]> {
  try {
    let data: Announcement[] = [];

    if (!category || category === "academic") {
      const academic = await fetchJson<Announcement[]>(
        "/data/announcements-academic.json",
        { fallback: [] },
      );
      data = [...data, ...academic];
    }

    if (!category || category === "scholarship") {
      const scholarship = await fetchJson<Announcement[]>(
        "/data/announcements-scholarship.json",
        { fallback: [] },
      );
      data = [
        ...data,
        ...scholarship.map((item: Announcement) => ({
          ...item,
          category: "scholarship" as const,
        })),
      ];
    }

    if (!category || category === "campus") {
      const campus = await fetchJson<Announcement[]>(
        "/data/announcements-campus-life.json",
        { fallback: [] },
      );
      data = [
        ...data,
        ...campus.map((item: Announcement) => ({
          ...item,
          category: "campus" as const,
        })),
      ];
    }

    return data;
  } catch {
    // Return empty array if fetch fails
    return [];
  }
}

// 학식 API - 크롤링된 실제 데이터 사용
export async function fetchCafeteriaMenu(
  date?: string,
): Promise<CafeteriaMenu[]> {
  try {
    const data = await fetchJson<
      Array<{ menus?: unknown[] }> | { menus?: unknown[] }
    >("/data/cafeteria-menu.json", { fallback: [] });

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
  } catch {
    return [];
  }
}

// 학사일정 API - 크롤링된 실제 데이터 사용
export async function fetchAcademicSchedules(
  category?: string,
): Promise<AcademicSchedule[]> {
  try {
    const parsedSchedules = await fetchJson<AcademicSchedule[]>(
      "/data/schedules-major.json",
      { fallback: [] },
    );

    if (category) {
      return parsedSchedules.filter((s) => s.category === category);
    }
    return parsedSchedules;
  } catch {
    return [];
  }
}

// 셔틀버스 API - 크롤링된 실제 데이터 사용
export async function fetchShuttleBuses(): Promise<ShuttleBusSchedule[]> {
  try {
    return await fetchJson<ShuttleBusSchedule[]>(
      "/data/shuttle-bus-schedule.json",
      { fallback: [] },
    );
  } catch {
    return [];
  }
}

// 셔틀버스 특수 기간 API
export async function fetchShuttleSpecialPeriods(): Promise<ShuttleSpecialPeriods> {
  try {
    return await fetchJson<ShuttleSpecialPeriods>(
      "/data/shuttle-special-periods.json",
      { fallback: { specialPeriods: [], vacationPeriods: [] } },
    );
  } catch {
    return { specialPeriods: [], vacationPeriods: [] };
  }
}

// 장학금 API
export async function fetchScholarships(
  type?: "internal" | "external",
): Promise<Scholarship[]> {
  try {
    // API에서 실제 데이터 가져오기
    const notices = await fetchJson<Announcement[]>(
      "/data/announcements-scholarship.json",
      { fallback: [] },
    );

    const scholarshipData: Scholarship[] = notices
      .filter((notice) => {
        if (type === "internal") {
          return notice.title.includes("국내") || notice.title.includes("교내");
        } else if (type === "external") {
          return notice.title.includes("국외") || notice.title.includes("교외");
        }
        return true;
      })
      .map((notice) => ({
        id: notice.id,
        name: notice.title,
        type: (type || "internal") as "internal" | "external",
        description: notice.content || "",
        amount: 0,
        deadline: notice.author || notice.date, // author 필드에 실제 작성 날짜가 있음
        eligibility: "", // 공지사항에서 직접 추출 불가
        url: notice.url, // 외부 링크 추가
        isPinned: notice.isPinned || false, // 고정글 여부 추가
      }));

    return scholarshipData;
  } catch {
    return [];
  }
}

// 검색 API - 개선됨 (전체 데이터 통합 검색)
export async function searchAll(
  query: string,
): Promise<(Announcement | AcademicSchedule | Scholarship | PhoneNumber)[]> {
  if (!query.trim()) {
    return [];
  }

  const lowerQuery = query.toLowerCase();

  try {
    const results = await Promise.all([
      searchSchedules(lowerQuery),
      searchAnnouncementSource(
        "/data/announcements-academic.json",
        lowerQuery,
      ),
      searchAnnouncementSource(
        "/data/announcements-scholarship.json",
        lowerQuery,
        "scholarship",
      ),
      searchAnnouncementSource(
        "/data/announcements-campus-life.json",
        lowerQuery,
        "campus",
      ),
      searchPhoneNumberSource(query, lowerQuery),
    ]);

    const uniqueResults = sortSearchResults(
      dedupeSearchResults(results.flat()),
      query,
    );

    return uniqueResults.slice(0, 100); // 최대 100개로 제한
  } catch {
    return [];
  }
}

type SearchAllResult =
  | Announcement
  | AcademicSchedule
  | Scholarship
  | PhoneNumber;

async function searchSchedules(query: string): Promise<AcademicSchedule[]> {
  const schedules = await fetchJson<AcademicSchedule[]>(
    "/data/schedules-major.json",
    { fallback: [] },
  );

  return schedules.filter(
    (schedule) =>
      includesQuery(schedule.title, query) ||
      includesQuery(schedule.description, query),
  );
}

async function searchAnnouncementSource(
  path: string,
  query: string,
  category?: Announcement["category"],
): Promise<Announcement[]> {
  const announcements = await fetchJson<Announcement[]>(path, { fallback: [] });

  return announcements
    .filter(
      (announcement) =>
        includesQuery(announcement.title, query) ||
        includesQuery(announcement.content, query),
    )
    .map((announcement) =>
      category ? { ...announcement, category } : announcement,
    );
}

async function searchPhoneNumberSource(
  rawQuery: string,
  lowerQuery: string,
): Promise<PhoneNumber[]> {
  const phoneNumbers = await fetchJson<PhoneNumber[]>(
    "/data/phone-numbers.json",
    { fallback: [], noStore: false, next: { revalidate: 604800 } },
  );

  return phoneNumbers.filter(
    (phone) =>
      includesQuery(phone.department, lowerQuery) || phone.phone?.includes(rawQuery),
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
export async function fetchBusLocations(): Promise<BusLocation[]> {
  try {
    const data = await fetchJson<
      { returnCode?: string; data?: unknown[] } | unknown[]
    >("/bus/shuttle", {
      fallback: [],
      method: "GET",
      credentials: "omit",
    });

    if (Array.isArray(data)) {
      return data
        .map((bus) => {
          const busRecord = bus as Record<string, unknown>;
          const status = Number(busRecord.status);
          const routeid = Number(busRecord.routeid) as 1 | 2 | 3;

          return {
            ...busRecord,
            status: status as 0 | 1 | 2,
            routeid,
          } as BusLocation;
        })
        .filter((bus) => bus.status !== 0);
    }

    if (data && data.returnCode === "200") {
      const busArray = data.data || [];
      if (!Array.isArray(busArray)) return [];

      return busArray
        .map((bus) => {
          const busRecord = bus as Record<string, unknown>;
          const status = Number(busRecord.status);
          const routeid = Number(busRecord.routeid) as 1 | 2 | 3;

          return {
            ...busRecord,
            status: status as 0 | 1 | 2,
            routeid,
          } as BusLocation;
        })
        .filter((bus) => bus.status !== 0);
    }

    return [];
  } catch {
    return [];
  }
}

export {
  PUBLIC_TRANSIT_STOPS,
  fetchPublicTransitArrivals,
  fetchGyeonggiBusLocations,
} from "./public-transit";
