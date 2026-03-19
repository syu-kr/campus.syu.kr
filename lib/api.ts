import {
  Announcement,
  CafeteriaMenu,
  AcademicSchedule,
  ShuttleBusSchedule,
  Scholarship,
  AcademicInfo,
} from "@/types";

// 공지사항 API - 크롤링된 실제 데이터 사용
export async function fetchAnnouncements(
  category?: string,
): Promise<Announcement[]> {
  try {
    let data: Announcement[] = [];

    if (!category || category === "academic") {
      const academic = await fetch("/data/announcements-academic.json", {
        next: { revalidate: 3600 }, // Cache for 1 hour
      }).then((r) => r.json());
      data = [...data, ...(academic as Announcement[])];
    }

    if (!category || category === "scholarship") {
      const scholarship = await fetch(
        "/data/announcements-scholarship.json",
        { next: { revalidate: 3600 } }, // Cache for 1 hour
      ).then((r) => r.json());
      data = [
        ...data,
        ...(scholarship as Announcement[]).map((item: Announcement) => ({
          ...item,
          category: "scholarship" as const,
        })),
      ];
    }

    return data.slice(0, 100); // 최대 100개로 제한
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
      next: { revalidate: 3600 }, // Cache for 1 hour (매일 업데이트됨)
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
      let lunch: Array<{ name: string }> = [];
      if (menu.meals?.lunch) {
        if (Array.isArray(menu.meals.lunch)) {
          lunch = menu.meals.lunch.map((name) => ({ name }));
        } else if (typeof menu.meals.lunch === "object") {
          // A/B 코너가 분리된 경우
          const aCorner =
            (menu.meals.lunch as { a_corner?: string[] }).a_corner || [];
          const bCorner =
            (menu.meals.lunch as { b_corner?: string[] }).b_corner || [];
          lunch = [
            ...(aCorner.length > 0
              ? [{ name: `A코너: ${aCorner.join(", ")}` }]
              : []),
            ...(bCorner.length > 0
              ? [{ name: `B코너: ${bCorner.join(", ")}` }]
              : []),
            ...aCorner.map((name) => ({ name })),
            ...bCorner.map((name) => ({ name })),
          ];
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

export async function fetchWeeklyCafeteriaMenu(): Promise<CafeteriaMenu[]> {
  try {
    const response = await fetch("/data/cafeteria-menu.json", {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    const data = (await response.json()) as unknown;
    const cafeterias = Array.isArray(data) ? data : [];

    if (!cafeterias || cafeterias.length === 0) {
      throw new Error("No cafeteria data");
    }

    // 크롤러 데이터를 CafeteriaMenu 형식으로 변환
    const menus: CafeteriaMenu[] = [];
    const cafeteriaData = cafeterias[0] as {
      menus: Array<{
        date: string;
        day: string;
        meals: { breakfast: string[]; lunch: string[]; dinner: string[] };
      }>;
    };
    const menuDays = cafeteriaData?.menus || [];

    menuDays.forEach((menu, idx) => {
      const breakfast = menu.meals?.breakfast?.map((name) => ({ name })) || [];
      const lunch = menu.meals?.lunch?.map((name) => ({ name })) || [];
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

    return menus;
  } catch (error) {
    console.error("Failed to fetch weekly cafeteria menu:", error);
    return [];
  }
}

// 학사일정 API - 크롤링된 실제 데이터 사용
export async function fetchAcademicSchedules(
  category?: string,
): Promise<AcademicSchedule[]> {
  try {
    const schedules = await fetch("/data/schedules-major.json", {
      next: { revalidate: 86400 }, // Cache for 24 hours
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
      next: { revalidate: 86400 }, // Cache for 24 hours
    });
    const schedules = await response.json();
    return (schedules || []) as ShuttleBusSchedule[];
  } catch (error) {
    console.error("Failed to fetch shuttle buses:", error);
    return [];
  }
}

export async function fetchShuttleBusById(
  id: string,
): Promise<ShuttleBusSchedule | null> {
  try {
    const response = await fetch("/data/shuttle-bus-schedule.json", {
      next: { revalidate: 86400 }, // Cache for 24 hours
    });
    const schedules = (await response.json()) as ShuttleBusSchedule[];
    return schedules.find((b) => b.id === id) || null;
  } catch (error) {
    console.error("Failed to fetch shuttle bus:", error);
    return null;
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
        deadline: notice.date,
        eligibility: "", // 공지사항에서 직접 추출 불가
      }));

    return scholarshipData.slice(0, 50);
  } catch (error) {
    console.error("Failed to fetch scholarships:", error);
    return [];
  }
}

// 학사정보 API (Mock)
export async function fetchAcademicInfo(): Promise<AcademicInfo> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        gpa: 3.85,
        totalCredits: 130,
        completedCredits: 115,
        status: "normal",
        graduationDate: "2025-02-14",
      });
    }, 500);
  });
}

// 검색 API - 개선됨 (전체 데이터 통합 검색)
export async function searchAll(
  query: string,
): Promise<(Announcement | AcademicSchedule | CafeteriaMenu | Scholarship)[]> {
  if (!query.trim()) {
    return [];
  }

  const lowerQuery = query.toLowerCase();
  const results: (
    | Announcement
    | AcademicSchedule
    | CafeteriaMenu
    | Scholarship
  )[] = [];

  try {
    // 1. 크롤링된 공지사항 검색
    try {
      const eventNotices = await fetch("/data/announcements-events.json", {
        next: { revalidate: 3600 }, // Cache for 1 hour
      }).then((r) => r.json());
      const matchedEvents = (eventNotices as Announcement[]).filter(
        (a) =>
          a.title?.toLowerCase().includes(lowerQuery) ||
          a.content?.toLowerCase().includes(lowerQuery),
      );
      results.push(...matchedEvents);
    } catch {
      // handle silently
    }

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
      results.push(...matchedCampus);
    } catch {
      // handle silently
    }

    // 중복 제거 (ID 기반)
    const uniqueResults = Array.from(
      new Map(results.map((item) => [item.id, item])).values(),
    );

    return uniqueResults.slice(0, 100); // 최대 100개로 제한
  } catch (error) {
    console.error("Search failed:", error);
    return [];
  }
}

// 행사공지 API
export async function fetchEventNotices(): Promise<Announcement[]> {
  try {
    const events = await fetch("/data/announcements-events.json").then((r) =>
      r.json(),
    );
    return (events as Announcement[]).slice(0, 50);
  } catch (error) {
    console.error("Failed to fetch event notices:", error);
    return [];
  }
}

// 생활공지 API
export async function fetchCampusNotices(): Promise<Announcement[]> {
  try {
    const notices = await fetch("/data/announcements-campus-life.json").then(
      (r) => r.json(),
    );
    return (notices as Announcement[]).slice(0, 50);
  } catch (error) {
    console.error("Failed to fetch campus notices:", error);
    return [];
  }
}

// 캠퍼스맵 API
export async function fetchCampusMap(): Promise<
  { building: string; location: string; description?: string }[]
> {
  try {
    const map = await fetch("/data/campus-map.json").then((r) => r.json());
    return map;
  } catch (error) {
    console.error("Failed to fetch campus map:", error);
    return [];
  }
}

// 수강신청 안내 API
export async function fetchRegistrationGuide(): Promise<
  {
    period: string;
    startDate: string;
    endDate: string;
    description: string;
    targetGrade?: string;
  }[]
> {
  try {
    const guide = await fetch("/data/registration-guide.json").then((r) =>
      r.json(),
    );
    return guide;
  } catch (error) {
    console.error("Failed to fetch registration guide:", error);
    return [];
  }
}

// 동아리 API
export async function fetchClubs(
  category?: "general" | "startup" | "employment",
): Promise<{ id: string; name: string; category: string; url: string }[]> {
  try {
    const clubs = await fetch("/data/clubs.json").then((r) => r.json());
    if (category) {
      return (
        clubs as { id: string; name: string; category: string; url: string }[]
      ).filter((c) => c.category === category);
    }
    return clubs;
  } catch (error) {
    console.error("Failed to fetch clubs:", error);
    return [];
  }
}

// TODO: 추후 실제 백엔드와 연동 시 다음과 같이 fetch를 사용하면 됨
// export async function fetchAnnouncements(category?: string) {
//   const response = await fetch(`/api/announcements?category=${category || ''}`);
//   if (!response.ok) throw new Error('Failed to fetch announcements');
//   return response.json();
// }
