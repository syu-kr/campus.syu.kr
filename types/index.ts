// 공지사항
export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: "academic" | "campus" | "admin" | "activity" | "scholarship";
  date: string;
  author: string;
  views: number;
  isImportant: boolean;
  url?: string;
}

// 학식
export interface CafeteriaMenu {
  id: string;
  date: string;
  dayOfWeek: string;
  breakfast: MenuItem[];
  lunch: {
    a?: MenuItem[];
    b?: MenuItem[];
  };
  dinner: MenuItem[];
  location: string;
}

export interface MenuItem {
  name: string;
  calories?: number;
  allergens?: string[];
}

// 학사일정
export interface AcademicSchedule {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  category: "registration" | "exam" | "holiday" | "event";
  description?: string;
}

// 셔틀버스
export interface ShuttleBusSchedule {
  id: string;
  routeName: string;
  startLocation: string;
  endLocation: string;
  schedules: {
    weekday: string[];
    weekend: string[];
  };
  lastUpdated: string;
}

// 학과 정보
export interface DepartmentInfo {
  id: string;
  name: string;
  building: string;
  phone: string;
  email: string;
  professors: {
    name: string;
    title: string;
    office: string;
  }[];
}

// 장학금
export interface Scholarship {
  id: string;
  name: string;
  type: "internal" | "external";
  amount: number;
  eligibility: string;
  deadline: string;
  description: string;
  url?: string;
}

// 학사정보
export interface AcademicInfo {
  gpa: number;
  totalCredits: number;
  completedCredits: number;
  status: "normal" | "leave" | "return";
  graduationDate?: string;
}

// 사용자 프로필
export interface UserProfile {
  studentId: string;
  name: string;
  department: string;
  grade: number;
  entryYear: number;
}

// 자주 사용하는 메뉴
export interface FrequentMenu {
  id: string;
  label: string;
  icon: string;
  path: string;
  rank: number;
}

// 검색 결과
export interface SearchResult {
  id: string;
  title: string;
  category: string;
  type: "announcement" | "page" | "menu" | "schedule";
  path?: string;
  highlight?: string;
}
