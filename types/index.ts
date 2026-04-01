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
  isPinned?: boolean;
  url?: string;
}

// 서비스 공지
export interface ServiceNotice {
  id: string;
  slug: string;
  title: string;
  date: string;
  author: string;
  excerpt?: string;
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
    mondayToThursday: string[];
    friday: string[];
    mondayToThursdayVacation: string[];
    fridayVacation: string[];
  };
  lastUpdated: string;
}

// 버스 실시간 위치
export interface BusLocation {
  id: string;
  name: string;
  lat: string;
  lon: string;
  status: 0 | 1 | 2; // 0: 운행 안함, 1: 학교→역, 2: 역→학교
  routeid: 1 | 2 | 3; // 1: 화랑대역, 2: 석계역, 3: 별내역
}

// 학과 정보 (미사용 - 제거됨)

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

// 학사정보 (미사용 - 제거됨)

// 사용자 프로필 (미사용 - 제거됨)

// 전화번호
export interface PhoneNumber {
  department: string;
  phone: string;
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
