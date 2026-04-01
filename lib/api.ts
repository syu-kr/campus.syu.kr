import {
  Announcement,
  CafeteriaMenu,
  AcademicSchedule,
  ShuttleBusSchedule,
  BusLocation,
  Scholarship,
  PhoneNumber,
} from "@/types";

// 공지사항 API - 크롤링된 실제 데이터 사용
export async function fetchAnnouncements(
  category?: string,
): Promise<Announcement[]> {
  try {
    let data: Announcement[] = [];

    if (!category || category === "academic") {
      const academic = await fetch("/data/announcements-academic.json", {
        next: { revalidate: 0 }, // ❌ No cache - always fetch fresh data
      }).then((r) => r.json());
      data = [...data, ...(academic as Announcement[])];
    }

    if (!category || category === "scholarship") {
      const scholarship = await fetch(
        "/data/announcements-scholarship.json",
        { next: { revalidate: 0 } }, // ❌ No cache - always fetch fresh data
      ).then((r) => r.json());
      data = [
        ...data,
        ...(scholarship as Announcement[]).map((item: Announcement) => ({
          ...item,
          category: "scholarship" as const,
        })),
      ];
    }

    if (!category || category === "campus") {
      try {
        const campus = await fetch(
          "/data/announcements-campus-life.json",
          { next: { revalidate: 0 } }, // ❌ No cache - always fetch fresh data
        ).then((r) => r.json());
        data = [
          ...data,
          ...(campus as Announcement[]).map((item: Announcement) => ({
            ...item,
            category: "campus" as const,
          })),
        ];
      } catch {
        // handle silently
      }
    }

    return data;
  } catch (error) {
    console.error("Failed to fetch announcements:", error);
    // Return empty array if fetch fails
    return [];
  }
}

export async function fetchAnnouncementById(
  id: string,
): Promise<Announcement | null> {
  try {
    // 크롤링된 데이터에서 검색
    const academic = await fetch("/data/announcements-academic.json").then(
      (r) => r.json(),
    );
    let found = (academic as Announcement[]).find(
      (a: Announcement) => a.id === id,
    );
    if (found) return found;

    const scholarship = await fetch(
      "/data/announcements-scholarship.json",
    ).then((r) => r.json());
    found = (scholarship as Announcement[]).find(
      (a: Announcement) => a.id === id,
    );
    if (found) return { ...found, category: "scholarship" as const };

    return null;
  } catch (error) {
    console.error("Failed to fetch announcement:", error);
    return null;
  }
}

// 학식 API - 크롤링된 실제 데이터 사용
export async function fetchCafeteriaMenu(
  date?: string,
): Promise<CafeteriaMenu[]> {
  try {
    const response = await fetch("/data/cafeteria-menu.json", {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    const data = (await response.json()) as
      | Array<{ menus?: unknown[] }>
      | { menus?: unknown[] };

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
    console.error("Failed to fetch cafeteria menu:", error);
    return [];
  }
}

// 학사일정 API - 크롤링된 실제 데이터 사용
export async function fetchAcademicSchedules(
  category?: string,
): Promise<AcademicSchedule[]> {
  try {
    const schedules = await fetch("/data/schedules-major.json", {
      next: { revalidate: 604800 }, // Cache for 7 days
    }).then((r) => r.json());

    const parsedSchedules = (schedules || []) as AcademicSchedule[];

    if (category) {
      return parsedSchedules.filter((s) => s.category === category);
    }
    return parsedSchedules;
  } catch (error) {
    console.error("Failed to fetch academic schedules:", error);
    // Return empty array instead of mock data
    return [];
  }
}

// 셔틀버스 API - 크롤링된 실제 데이터 사용
export async function fetchShuttleBuses(): Promise<ShuttleBusSchedule[]> {
  try {
    const response = await fetch("/data/shuttle-bus-schedule.json", {
      next: { revalidate: 604800 }, // Cache for 7 days
    });
    const schedules = await response.json();
    return (schedules || []) as ShuttleBusSchedule[];
  } catch (error) {
    console.error("Failed to fetch shuttle buses:", error);
    return [];
  }
}

// 장학금 API
export async function fetchScholarships(
  type?: "internal" | "external",
): Promise<Scholarship[]> {
  try {
    // API에서 실제 데이터 가져오기
    const response = await fetch("/data/announcements-scholarship.json");
    const notices = await response.json();

    const scholarshipData: Scholarship[] = (notices as Announcement[])
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
      }));

    return scholarshipData;
  } catch (error) {
    console.error("Failed to fetch scholarships:", error);
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
  const results: (
    | Announcement
    | AcademicSchedule
    | Scholarship
    | PhoneNumber
  )[] = [];

  try {
    // 1. 학사일정 검색
    try {
      const schedules = await fetch("/data/schedules-major.json", {
        next: { revalidate: 604800 },
      }).then((r) => r.json());
      const matchedSchedules = (schedules as AcademicSchedule[]).filter(
        (s) =>
          s.title?.toLowerCase().includes(lowerQuery) ||
          s.description?.toLowerCase().includes(lowerQuery),
      );
      results.push(...matchedSchedules);
    } catch {
      // handle silently
    }

    // 2. 크롤링된 공지사항 검색

    // 학사공지
    try {
      const academicNotices = await fetch("/data/announcements-academic.json", {
        next: { revalidate: 3600 },
      }).then((r) => r.json());
      const matchedAcademic = (academicNotices as Announcement[]).filter(
        (a) =>
          a.title?.toLowerCase().includes(lowerQuery) ||
          a.content?.toLowerCase().includes(lowerQuery),
      );
      results.push(...matchedAcademic);
    } catch {
      // handle silently
    }

    // 장학금
    try {
      const scholarshipNotices = await fetch(
        "/data/announcements-scholarship.json",
        { next: { revalidate: 3600 } },
      ).then((r) => r.json());
      const matchedScholarship = (scholarshipNotices as Announcement[]).filter(
        (a) =>
          a.title?.toLowerCase().includes(lowerQuery) ||
          a.content?.toLowerCase().includes(lowerQuery),
      );
      const withCategory = matchedScholarship.map((item) => ({
        ...item,
        category: "scholarship" as const,
      }));
      results.push(...withCategory);
    } catch {
      // handle silently
    }

    // 캠퍼스공지
    try {
      const campusNotices = await fetch(
        "/data/announcements-campus-life.json",
        { next: { revalidate: 3600 } }, // Cache for 1 hour
      ).then((r) => r.json());
      const matchedCampus = (campusNotices as Announcement[]).filter(
        (a) =>
          a.title?.toLowerCase().includes(lowerQuery) ||
          a.content?.toLowerCase().includes(lowerQuery),
      );
      const withCategory = matchedCampus.map((item) => ({
        ...item,
        category: "campus" as const,
      }));
      results.push(...withCategory);
    } catch {
      // handle silently
    }

    // 3. 전화번호 검색
    try {
      const phoneNumbers = await fetch("/data/phone-numbers.json", {
        next: { revalidate: 604800 },
      }).then((r) => r.json());
      const matchedPhones = (phoneNumbers as PhoneNumber[]).filter(
        (p) =>
          p.department?.toLowerCase().includes(lowerQuery) ||
          p.phone?.includes(query),
      );
      results.push(...matchedPhones);
    } catch {
      // handle silently
    }

    // 중복 제거 (ID 또는 phone/department 기반)
    const uniqueResults = Array.from(
      new Map<
        string,
        Announcement | AcademicSchedule | Scholarship | PhoneNumber
      >(
        results.map((item) => {
          if ("phone" in item) {
            return [item.phone, item];
          }
          return [item.id, item];
        }),
      ).values(),
    );

    return uniqueResults.slice(0, 100); // 최대 100개로 제한
  } catch (error) {
    console.error("Search failed:", error);
    return [];
  }
}

// 전화번호 API
export async function fetchPhoneNumbers(): Promise<PhoneNumber[]> {
  try {
    const response = await fetch("/data/phone-numbers.json", {
      next: { revalidate: 604800 }, // Cache for 7 days
    });
    const phoneData = await response.json();
    return (phoneData || []) as PhoneNumber[];
  } catch (error) {
    console.error("Failed to fetch phone numbers:", error);
    return [];
  }
}

// 버스 실시간 위치 API
export async function fetchBusLocations(): Promise<BusLocation[]> {
  try {
    const response = await fetch("/bus/busStatusList.php", {
      method: "POST",
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    // returnCode === "200" 또는 배열 데이터 직접 확인
    if (data && (data.returnCode === "200" || Array.isArray(data.data))) {
      const busArray = data.data || data;
      if (!Array.isArray(busArray)) return [];

      return busArray
        .filter((bus: Record<string, unknown>) => bus && bus.status !== 0)
        .map(
          (bus: Record<string, unknown>) =>
            ({
              ...bus,
              routeid: Number(bus.routeid) as 1 | 2 | 3,
              status: Number(bus.status) as 0 | 1 | 2,
            }) as BusLocation,
        );
    }

    return [];
  } catch {
    return [];
  }
}
