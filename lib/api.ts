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

// 공지사항 API
export async function fetchAnnouncements(
  category?: string,
): Promise<Announcement[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (category) {
        resolve(
          (announcements as Announcement[]).filter(
            (a) => a.category === category,
          ),
        );
      } else {
        resolve(announcements as Announcement[]);
      }
    }, 500);
  });
}

export async function fetchAnnouncementById(
  id: string,
): Promise<Announcement | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const announcement = (announcements as Announcement[]).find(
        (a) => a.id === id,
      );
      resolve(announcement || null);
    }, 300);
  });
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

// 학사일정 API
export async function fetchAcademicSchedules(
  category?: string,
): Promise<AcademicSchedule[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (category) {
        resolve(
          (schedules as AcademicSchedule[]).filter(
            (s) => s.category === category,
          ),
        );
      } else {
        resolve(schedules as AcademicSchedule[]);
      }
    }, 500);
  });
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

// 검색 API
export async function searchAll(
  query: string,
): Promise<(Announcement | AcademicSchedule | CafeteriaMenu | Scholarship)[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const lowerQuery = query.toLowerCase();
      const results: (
        | Announcement
        | AcademicSchedule
        | CafeteriaMenu
        | Scholarship
      )[] = [];

      // 공지사항 검색
      const matchedAnnouncements = (announcements as Announcement[]).filter(
        (a) =>
          a.title.toLowerCase().includes(lowerQuery) ||
          a.content.toLowerCase().includes(lowerQuery),
      );
      results.push(...matchedAnnouncements);

      // 학사일정 검색
      const matchedSchedules = (schedules as AcademicSchedule[]).filter(
        (s) =>
          s.title.toLowerCase().includes(lowerQuery) ||
          s.description?.toLowerCase().includes(lowerQuery),
      );
      results.push(...matchedSchedules);

      // 장학금 검색
      const matchedScholarships = (scholarships as Scholarship[]).filter(
        (s) =>
          s.name.toLowerCase().includes(lowerQuery) ||
          s.description.toLowerCase().includes(lowerQuery),
      );
      results.push(...matchedScholarships);

      resolve(results);
    }, 800);
  });
}

// TODO: 추후 실제 백엔드와 연동 시 다음과 같이 fetch를 사용하면 됨
// export async function fetchAnnouncements(category?: string) {
//   const response = await fetch(`/api/announcements?category=${category || ''}`);
//   if (!response.ok) throw new Error('Failed to fetch announcements');
//   return response.json();
// }
