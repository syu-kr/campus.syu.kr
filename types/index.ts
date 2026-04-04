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
  isPinned?: boolean;
}

// 학사정보 (미사용 - 제거됨)

// 사용자 프로필 (미사용 - 제거됨)

// 대중교통 정류장
export interface BusStop {
  id: string; // 고유 ID (정문상행, 정문하행, 후문상행, 후문하행)
  name: string; // 정류소명
  region: "seoul" | "gyeonggi"; // 지역
  seoulArsId?: string; // 서울 정류소 고유번호
  gyeonggiStationIds?: string[]; // 경기도 정류소 ID 배열
  lat: number; // 위도
  lon: number; // 경도
  direction: "up" | "down"; // 상행/하행
}

// 버스 도착 정보
export interface BusArrival {
  routeId: string; // 노선 ID
  routeName: string; // 노선명 (예: "100번")
  arrivalMsg1: string; // 첫번째 도착 메시지 (예: "2분")
  arrivalMsg2: string; // 두번째 도착 메시지
  isLow1: boolean; // 첫번째 저상버스 여부
  isLow2: boolean; // 두번째 저상버스 여부
  crowded1?: number; // 첫번째 버스 혼잡도 (0=여유, 1=보통, 2=혼잡)
  crowded2?: number; // 두번째 버스 혼잡도
  locationNo1?: number; // 첫번째 버스까지 정거장 수
  locationNo2?: number; // 두번째 버스까지 정거장 수
  nextStation1?: string; // 첫번째 다음 정류소
  nextStation2?: string; // 두번째 다음 정류소
  predictTime1?: number; // 첫번째 도착까지 초 단위 시간
  predictTime2?: number; // 두번째 도착까지 초 단위 시간
  remainSeat1?: number; // 첫번째 버스 빈자리 (경기도만, 미사용)
  remainSeat2?: number; // 두번째 버스 빈자리
}

// 정류소별 도착 정보
export interface BusArrivalsAtStop {
  stop: BusStop;
  arrivals: BusArrival[];
  lastUpdated: Date;
}

// 버스 위치 정보
export interface BusLocationInfo {
  vehId: string; // 차량 ID
  routeId: string; // 노선 ID
  routeName: string; // 노선명
  lat: number; // 위도
  lon: number; // 경도
  nextStationName: string; // 다음 정류소명
}

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
