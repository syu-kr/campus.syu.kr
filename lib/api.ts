import {
  Announcement,
  CafeteriaMenu,
  AcademicSchedule,
  ShuttleBusSchedule,
  Scholarship,
  AcademicInfo,
} from "@/types";
import announcements from "@/data/announcements.json";
import cafeteriaMenu from "@/data/cafeteria.json";
import schedules from "@/data/schedule.json";
import shuttleBuses from "@/data/shuttle-bus.json";
import scholarships from "@/data/scholarships.json";

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

    // mock 데이터도 유지 (legacy support)
    if (!category) {
      const mockData = await import("@/data/announcements.json").then(
        (m) => m.default,
      );
      data = [
        ...data,
        ...(mockData as Announcement[]).filter(
          (a) =>
            !a.category.includes("academic") &&
            !a.category.includes("scholarship"),
        ),
      ];
    }

    return data.slice(0, 100); // 최대 100개로 제한
  } catch (error) {
    console.error("Failed to fetch announcements:", error);
    // fallback to mock data
    const announcements = await import("@/data/announcements.json").then(
      (m) => m.default,
    );
    if (category) {
      return (announcements as Announcement[]).filter(
        (a) => a.category === category,
      );
    }
    return announcements as Announcement[];
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

    // mock 데이터에서 검색
    const mockData = await import("@/data/announcements.json").then(
      (m) => m.default,
    );
    return (mockData as Announcement[]).find((a) => a.id === id) || null;
  } catch (error) {
    console.error("Failed to fetch announcement:", error);
    const mockData = await import("@/data/announcements.json").then(
      (m) => m.default,
    );
    return (mockData as Announcement[]).find((a) => a.id === id) || null;
  }
}

// 학식 API
export async function fetchCafeteriaMenu(
  date?: string,
): Promise<CafeteriaMenu[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (date) {
        resolve(
          (cafeteriaMenu as CafeteriaMenu[]).filter((m) => m.date === date),
        );
      } else {
        resolve(cafeteriaMenu as CafeteriaMenu[]);
      }
    }, 500);
  });
}

export async function fetchWeeklyCafeteriaMenu(): Promise<CafeteriaMenu[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(cafeteriaMenu as CafeteriaMenu[]);
    }, 500);
  });
}

// 학사일정 API - 크롤링된 실제 데이터 사용
export async function fetchAcademicSchedules(
  category?: string,
): Promise<AcademicSchedule[]> {
  try {
    const schedules = await fetch("/data/schedules-major.json", {
      next: { revalidate: 86400 }, // Cache for 24 hours
    }).then((r) => r.json());
    if (category) {
      return (schedules as AcademicSchedule[]).filter(
        (s) => s.category === category,
      );
    }
    return schedules as AcademicSchedule[];
  } catch (error) {
    console.error("Failed to fetch academic schedules:", error);
    // fallback to mock data
    const mockSchedules = await import("@/data/schedule.json").then(
      (m) => m.default,
    );
    if (category) {
      return (mockSchedules as AcademicSchedule[]).filter(
        (s) => s.category === category,
      );
    }
    return mockSchedules as AcademicSchedule[];
  }
}

// 셔틀버스 API
export async function fetchShuttleBuses(): Promise<ShuttleBusSchedule[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(shuttleBuses as ShuttleBusSchedule[]);
    }, 500);
  });
}

export async function fetchShuttleBusById(
  id: string,
): Promise<ShuttleBusSchedule | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const bus = (shuttleBuses as ShuttleBusSchedule[]).find(
        (b) => b.id === id,
      );
      resolve(bus || null);
    }, 300);
  });
}

// 장학금 API
export async function fetchScholarships(
  type?: "internal" | "external",
): Promise<Scholarship[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (type) {
        resolve((scholarships as Scholarship[]).filter((s) => s.type === type));
      } else {
        resolve(scholarships as Scholarship[]);
      }
    }, 500);
  });
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

    // 2. Mock 공지사항 검색 (legacy)
    const mockAnnouncements = (announcements as Announcement[]).filter(
      (a) =>
        a.title.toLowerCase().includes(lowerQuery) ||
        a.content.toLowerCase().includes(lowerQuery),
    );
    results.push(...mockAnnouncements);

    // 3. 학사일정 검색
    const matchedSchedules = (schedules as AcademicSchedule[]).filter(
      (s) =>
        s.title.toLowerCase().includes(lowerQuery) ||
        s.description?.toLowerCase().includes(lowerQuery),
    );
    results.push(...matchedSchedules);

    // 4. 장학금 검색
    const matchedScholarships = (scholarships as Scholarship[]).filter(
      (s) =>
        s.name.toLowerCase().includes(lowerQuery) ||
        s.description.toLowerCase().includes(lowerQuery),
    );
    results.push(...matchedScholarships);

    // 중복 제거 (ID 기반)
    const uniqueResults = Array.from(
      new Map(results.map((item) => [item.id, item])).values(),
    );

    return uniqueResults.slice(0, 100); // 최대 100개로 제한
  } catch (error) {
    console.error("Search failed:", error);
    // Fallback: mock 데이터만이라도 검색
    const mockAnnouncements = (announcements as Announcement[]).filter(
      (a) =>
        a.title.toLowerCase().includes(lowerQuery) ||
        a.content.toLowerCase().includes(lowerQuery),
    );
    const mockSchedules = (schedules as AcademicSchedule[]).filter(
      (s) =>
        s.title.toLowerCase().includes(lowerQuery) ||
        s.description?.toLowerCase().includes(lowerQuery),
    );
    return [...mockAnnouncements, ...mockSchedules];
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
