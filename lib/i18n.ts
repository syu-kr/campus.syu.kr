export const LOCALES = ["ko", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ko";
export const ENGLISH_LOCALE: Locale = "en";
export const LOCALE_COOKIE_NAME = "syu-campus-locale";
export const LOCALE_HEADER_NAME = "x-syu-locale";
export const PATHNAME_HEADER_NAME = "x-syu-pathname";

export const localeLabels: Record<Locale, string> = {
  ko: "대한민국 (한국어)",
  en: "Global (English)",
};

export function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function normalizeLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function getLocaleFromPathname(pathname: string): Locale {
  return pathname === "/en" || pathname.startsWith("/en/")
    ? ENGLISH_LOCALE
    : DEFAULT_LOCALE;
}

export function stripLocalePrefix(pathname: string): string {
  if (pathname === "/en") return "/";
  if (pathname.startsWith("/en/")) return pathname.slice(3) || "/";
  return pathname || "/";
}

export function localizePath(href: string, locale: Locale): string {
  if (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("#")
  ) {
    return href;
  }

  if (!href.startsWith("/")) {
    return href;
  }

  const hashIndex = href.indexOf("#");
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const queryIndex = withoutHash.indexOf("?");
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex) : "";
  const pathname =
    queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const strippedPathname = stripLocalePrefix(pathname);
  const localizedPathname =
    locale === ENGLISH_LOCALE
      ? strippedPathname === "/"
        ? "/en"
        : `/en${strippedPathname}`
      : strippedPathname;

  return `${localizedPathname}${query}${hash}`;
}

export const dictionaries = {
  ko: {
    meta: {
      title: "SYU CAMPUS - 학생 통합 정보 플랫폼",
      description: "삼육대학교 공지사항, 학식, 학사일정을 한눈에 확인하세요.",
      keywords: "삼육대, 삼육대학교, 캠퍼스, 공지사항, 학식, 학사일정",
      schemaDescription:
        "삼육대학교 학생들을 위한 공지사항, 학식, 셔틀버스, 학사일정 통합 정보 플랫폼",
      inLanguage: "ko-KR",
      openGraphLocale: "ko_KR",
    },
    navigation: {
      home: "홈",
      academic: "학사",
      campus: "캠퍼스",
      more: "더보기",
      back: "뒤로가기",
      mainNavigation: "메인 내비게이션",
      homepageTitle: "홈페이지로 이동",
      logoAlt: "삼육대학교 캠퍼스 통합 정보 플랫폼 로고 - 홈페이지로 이동",
    },
    footer: {
      tagline: "삼육대학교 학생을 위한 통합 정보 플랫폼",
      mainMenu: "주요 메뉴",
      academicInfo: "학사 정보",
      campusInfo: "캠퍼스 정보",
      more: "더보기",
      contactHeading: "서비스 문의 및 제안",
      contact: "사이트 문의하기",
      contactDescription: "오류, 정보 수정, 기능 제안 등을 남겨주세요.",
      emailContact: "메일로 문의",
      terms: "이용약관",
      privacy: "개인정보처리방침",
      notificationPrivacy: "알림 및 개인정보",
      githubRepo: "SYU CAMPUS GitHub 저장소",
      githubTitle: "GitHub 저장소",
      countrySetting: "국가/언어 설정",
    },
    search: {
      defaultPlaceholder: "공지, 학식, 학사일정 검색...",
      compactPlaceholder: "검색...",
      label: "검색",
      clear: "검색어 삭제",
      submit: "검색 실행",
      resultSuffix: "검색 결과",
      resetToHome: "검색 초기화 / 홈으로",
      noResultsTitle: "검색 결과가 없습니다",
      noResultsMessage:
        "와 일치하는 결과가 없습니다. 공지 제목, 일정명, 부서명, 전화번호로 검색할 수 있습니다.",
      cancel: "검색 취소",
      viewAll: "전체보기",
    },
    weather: {
      unavailable: "날씨 정보를 불러올 수 없습니다",
      loadError: "날씨 조회 중 오류가 발생했습니다",
      label: "날씨",
      current: "현재 날씨는",
      currentSuffix: "입니다.",
      precipitation: "강수형태",
      windSpeed: "풍속",
      skyCondition: "하늘상태",
      location: "위치",
      updated: "업데이트",
      close: "닫기",
      none: "없음",
      rain: "비",
      rainSnow: "비/눈",
      snow: "눈",
      drizzle: "이슬비",
      rainSnowFlurry: "빗방울눈날림",
      snowFlurry: "눈날림",
      clear: "맑음",
      partlyCloudy: "구름많음",
      cloudy: "흐림",
      unknown: "알 수 없음",
    },
    home: {
      frequentMenuTitle: "자주 사용하는 메뉴",
      relatedLinksTitle: "주요 서비스 바로가기",
      pwaTitle: "자주 쓰는 경우 앱처럼 열 수 있습니다",
      pwaDescription:
        "설치는 선택 사항이며, 브라우저에서도 같은 기능을 사용할 수 있습니다.",
      pwaAction: "앱처럼 쓰는 방법",
      dismissPwa: "앱 설치 안내 숨기기",
      menu: {
        cafeteria: "학식",
        bus: "버스 정보",
        campusTips: "캠퍼스 꿀팁",
        scholarship: "장학금",
        map: "캠퍼스 지도",
        library: "도서관",
      },
      links: {
        academicTitle: "학사 정보",
        academicDescription: "공지·일정·졸업요건",
        campusTitle: "캠퍼스 정보",
        campusDescription: "생활·시설·교통",
        moreTitle: "더보기",
        moreDescription: "장학금·연락처·도구",
        serviceTitle: "서비스 공지",
        serviceDescription: "업데이트 안내",
      },
      notices: {
        title: "공지사항",
        all: "전체",
        academic: "학사공지",
        scholarship: "장학금",
        campus: "캠퍼스",
        service: "서비스공지",
        emptyService: "선택한 서비스 공지가 없습니다.",
        emptyCategory: "선택한 분류에 공지사항이 없습니다.",
        allNotices: "전체 공지 보기",
        academicAll: "학사공지 전체보기",
        campusAll: "캠퍼스공지 전체보기",
        scholarshipAll: "장학금 전체보기",
        serviceAll: "서비스공지 전체보기",
      },
      dashboard: {
        cafeteria: "학식",
        shuttle: "다음 셔틀",
        todaySchedules: "오늘의 일정",
        weekendMenu:
          "오늘은 주말입니다. 주말을 알차게 보내보는건 어떨까요?",
        closedMenuTitle: "오늘은 운영하지 않습니다",
        closedMenuMessage:
          "공휴일 또는 운영하지 않는 날입니다. 전체 식단에서 다른 날짜를 확인해보세요.",
        missingMenu:
          "오늘 식단 정보가 없습니다. 전체 식단에서 다른 날짜를 확인해보세요.",
        pendingMenuTitle: "식단 준비 중입니다",
        pendingMenuMessage: "데이터가 준비되고 있습니다. 잠시만 기다려주세요.",
        fullMenu: "전체 식단 보기",
        todayMenu: "오늘의 메뉴",
        breakfast: "조식",
        lunch: "중식",
        dinner: "석식",
        cornerA: "A 코너",
        cornerB: "B 코너",
        closedMeal: "운영 없음",
        extraItems: " 외",
        shuttleWeekend: "오늘은 주말입니다. 셔틀버스가 운행되지 않습니다.",
        shuttleNoMore:
          "오늘 남은 셔틀 운행이 없습니다. 전체 시간표를 확인해보세요.",
        shuttleSchedule: "셔틀 시간표 보기",
        specialSchedule: "특별운행",
        departs: "출발",
        minutesAfter: "분 뒤",
        scheduleEmpty: "오늘 일정이 없습니다.",
        exam: "시험",
        schedule: "일정",
      },
    },
    academic: {
      title: "학사 정보",
      description: "학사 관련 정보를 한눈에 확인하세요",
      metaDescription:
        "삼육대학교 학사 정보 센터. 학사일정, 공지사항, 졸업요건 확인 등 핵심 학사 정보를 제공합니다.",
      menus: {
        announcementsTitle: "학사공지",
        announcementsDescription: "학사 관련 공지사항",
        scheduleTitle: "학사일정",
        scheduleDescription: "수강신청, 시험, 휴무 일정",
        scholarshipTitle: "장학금",
        scholarshipDescription: "장학금 공지 및 신청",
        graduationTitle: "졸업요건 확인",
        graduationDescription: "내 상황에 맞는 졸업요건 체크",
        timetableTitle: "시간표 짜기",
        timetableDescription: "학기 시간표 작성 마법사",
        mockSugangTitle: "모의 수강신청",
        mockSugangDescription: "수강신청 미리 연습하기",
        basketCompetitionTitle: "수강신청 장바구니 경쟁률",
        basketCompetitionDescription: "강의 경쟁률 확인",
      },
    },
    campus: {
      title: "캠퍼스 정보",
      description: "캠퍼스 생활에 필요한 정보를 확인하세요",
      metaDescription:
        "삼육대학교 캠퍼스 정보 센터. 학식, 도서관, 보건센터, 셔틀버스 및 캠퍼스 시설 정보를 확인하세요.",
      menus: {
        announcementsTitle: "캠퍼스공지",
        announcementsDescription: "캠퍼스 생활 공지사항",
        cafeteriaTitle: "학식",
        cafeteriaDescription: "주간 식단 및 영양정보",
        busTitle: "버스 정보",
        busDescription: "셔틀버스와 대중교통 안내",
        libraryTitle: "도서관",
        libraryDescription: "중앙도서관 열람실 정보",
        mapTitle: "캠퍼스 지도",
        mapDescription: "건물 위치 및 시설 안내",
        phoneTitle: "연락처 검색",
        phoneDescription: "부서 및 담당자 연락처",
        campusTipsTitle: "캠퍼스 꿀팁",
        campusTipsDescription: "학교생활에 필요한 링크 모음",
        gymTitle: "체육시설",
        gymDescription: "헬스장, 스포츠 센터 정보",
        healthCenterTitle: "보건소",
        healthCenterDescription: "학생 의료 서비스",
      },
    },
    more: {
      title: "더보기",
      description: "추가 기능을 확인하세요",
      translationTitle: "번역 안내",
      translationDescription:
        "외국어 번역이 필요하다면 Chrome, Edge, Safari의 브라우저 번역 기능을 사용하세요. PWA 앱에서는 현재 페이지를 브라우저에서 연 뒤 번역 메뉴를 사용할 수 있습니다.",
      menus: {
        serviceTitle: "서비스 공지",
        serviceDescription: "SYU CAMPUS 서비스 공지",
        meetTitle: "일정 잡기",
        meetDescription: "초대 링크로 가능한 시간 찾기",
        privacyTitle: "알림 및 개인정보",
        privacyDescription: "알림 권한과 분석 도구 안내",
      },
    },
    categories: {
      academicSchedule: "학사일정",
      academicAnnouncement: "학사공지",
      campusAnnouncement: "캠퍼스공지",
      scholarship: "장학금",
      phoneNumbers: "연락처",
      academic: "학사공지",
      campus: "캠퍼스",
      registration: "수강신청",
      exam: "시험",
      holiday: "휴무",
      event: "행사",
    },
    labels: {
      pinned: "고정글",
      important: "중요",
      notice: "공지",
      phone: "전화",
      error: "오류",
      warning: "경고",
      info: "정보",
      sahmyookUniversity: "삼육대학교",
    },
    pages: {
      announcements: {
        allTitle: "전체 공지",
        allDescription:
          "학사공지, 캠퍼스공지, 장학금 공지를 최신순으로 확인하세요",
        allError: "공지를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        academicTitle: "학사공지",
        academicDescription: "학사 관련 주요 공지사항을 확인하세요",
        academicError:
          "학사공지를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        campusTitle: "캠퍼스공지",
        campusDescription: "캠퍼스 생활 및 주요 공지사항을 확인하세요",
        campusError:
          "캠퍼스공지를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        listSearchPlaceholder: "제목 또는 작성자로 검색...",
        foundItems: "개 항목 찾음",
        searchQuery: "검색어",
        empty: "검색 결과가 없습니다.",
      },
    },
  },
  en: {
    meta: {
      title: "SYU CAMPUS - Student Information Hub",
      description:
        "Check Sahmyook University notices, cafeteria menus, shuttle buses, and academic schedules in one place.",
      keywords:
        "Sahmyook University, SYU, campus, notices, cafeteria, academic schedule",
      schemaDescription:
        "An integrated campus information hub for Sahmyook University students, including notices, cafeteria menus, shuttle buses, and academic schedules.",
      inLanguage: "en",
      openGraphLocale: "en_US",
    },
    navigation: {
      home: "Home",
      academic: "Academic",
      campus: "Campus",
      more: "More",
      back: "Back",
      mainNavigation: "Main navigation",
      homepageTitle: "Go to homepage",
      logoAlt:
        "SYU CAMPUS integrated campus information platform logo - go to homepage",
    },
    footer: {
      tagline:
        "Integrated information platform for Sahmyook University students",
      mainMenu: "Main Menu",
      academicInfo: "Academic Info",
      campusInfo: "Campus Info",
      more: "More",
      contactHeading: "Contact and Suggestions",
      contact: "Contact the site",
      contactDescription:
        "Send errors, information corrections, or feature suggestions.",
      emailContact: "Contact by email",
      terms: "Terms",
      privacy: "Privacy Policy",
      notificationPrivacy: "Notifications and Privacy",
      githubRepo: "SYU CAMPUS GitHub repository",
      githubTitle: "GitHub repository",
      countrySetting: "Country / Language",
    },
    search: {
      defaultPlaceholder: "Search notices, cafeteria, academic schedule...",
      compactPlaceholder: "Search...",
      label: "Search",
      clear: "Clear search query",
      submit: "Run search",
      resultSuffix: "results",
      resetToHome: "Clear search / Home",
      noResultsTitle: "No results found",
      noResultsMessage:
        "did not match any results. You can search by notice title, schedule name, department, or phone number.",
      cancel: "Cancel search",
      viewAll: "View all",
    },
    weather: {
      unavailable: "Weather information is unavailable",
      loadError: "An error occurred while loading weather",
      label: "Weather",
      current: "Current weather is",
      currentSuffix: ".",
      precipitation: "Precipitation",
      windSpeed: "Wind speed",
      skyCondition: "Sky condition",
      location: "Location",
      updated: "Updated",
      close: "Close",
      none: "None",
      rain: "Rain",
      rainSnow: "Rain/Snow",
      snow: "Snow",
      drizzle: "Drizzle",
      rainSnowFlurry: "Rain/Snow flurry",
      snowFlurry: "Snow flurry",
      clear: "Clear",
      partlyCloudy: "Mostly cloudy",
      cloudy: "Cloudy",
      unknown: "Unknown",
    },
    home: {
      frequentMenuTitle: "Frequently Used",
      relatedLinksTitle: "Main Services",
      pwaTitle: "Open it like an app if you use it often",
      pwaDescription:
        "Installation is optional. The same features work in the browser.",
      pwaAction: "How to use it like an app",
      dismissPwa: "Hide app installation guide",
      menu: {
        cafeteria: "Cafeteria",
        bus: "Bus Info",
        campusTips: "Campus Tips",
        scholarship: "Scholarships",
        map: "Campus Map",
        library: "Library",
      },
      links: {
        academicTitle: "Academic Info",
        academicDescription: "Notices, schedules, graduation",
        campusTitle: "Campus Info",
        campusDescription: "Life, facilities, transit",
        moreTitle: "More",
        moreDescription: "Scholarships, contacts, tools",
        serviceTitle: "Service Notices",
        serviceDescription: "Updates and announcements",
      },
      notices: {
        title: "Notices",
        all: "All",
        academic: "Academic",
        scholarship: "Scholarships",
        campus: "Campus",
        service: "Service",
        emptyService: "There are no service notices in this category.",
        emptyCategory: "There are no notices in the selected category.",
        allNotices: "All notices",
        academicAll: "All academic notices",
        campusAll: "All campus notices",
        scholarshipAll: "All scholarships",
        serviceAll: "All service notices",
      },
      dashboard: {
        cafeteria: "Cafeteria",
        shuttle: "Next Shuttle",
        todaySchedules: "Today's Schedule",
        weekendMenu: "It is the weekend today. Enjoy your day.",
        closedMenuTitle: "Closed today",
        closedMenuMessage:
          "The cafeteria is closed for a holiday or non-operating day. Check the full menu for other dates.",
        missingMenu:
          "Today's menu is unavailable. Check the full menu for other dates.",
        pendingMenuTitle: "Menu is being prepared",
        pendingMenuMessage: "The data is being prepared. Please check again soon.",
        fullMenu: "View full menu",
        todayMenu: "Today's Menu",
        breakfast: "Breakfast",
        lunch: "Lunch",
        dinner: "Dinner",
        cornerA: "Corner A",
        cornerB: "Corner B",
        closedMeal: "Closed",
        extraItems: " more",
        shuttleWeekend: "It is the weekend today. Shuttle buses are not running.",
        shuttleNoMore:
          "There are no remaining shuttle departures today. Check the full timetable.",
        shuttleSchedule: "View shuttle timetable",
        specialSchedule: "Special schedule",
        departs: "departure",
        minutesAfter: "min later",
        scheduleEmpty: "There are no schedules today.",
        exam: "Exam",
        schedule: "Schedule",
      },
    },
    academic: {
      title: "Academic Info",
      description: "Find academic information at a glance",
      metaDescription:
        "Sahmyook University academic information center for schedules, notices, graduation requirements, and timetable tools.",
      menus: {
        announcementsTitle: "Academic Notices",
        announcementsDescription: "Academic-related notices",
        scheduleTitle: "Academic Schedule",
        scheduleDescription: "Registration, exams, and holidays",
        scholarshipTitle: "Scholarships",
        scholarshipDescription: "Scholarship notices and applications",
        graduationTitle: "Graduation Check",
        graduationDescription: "Check requirements for your situation",
        timetableTitle: "Timetable Builder",
        timetableDescription: "Build your semester timetable",
        mockSugangTitle: "Mock Course Registration",
        mockSugangDescription: "Practice course registration in advance",
        basketCompetitionTitle: "Course Basket Competition",
        basketCompetitionDescription: "Check course competition rates",
      },
    },
    campus: {
      title: "Campus Info",
      description: "Find information for campus life",
      metaDescription:
        "Sahmyook University campus information center for cafeteria menus, library, health center, shuttle buses, and campus facilities.",
      menus: {
        announcementsTitle: "Campus Notices",
        announcementsDescription: "Campus life notices",
        cafeteriaTitle: "Cafeteria",
        cafeteriaDescription: "Weekly menus and nutrition info",
        busTitle: "Bus Info",
        busDescription: "Shuttle bus and public transit guide",
        libraryTitle: "Library",
        libraryDescription: "Central Library reading room info",
        mapTitle: "Campus Map",
        mapDescription: "Building locations and facilities",
        phoneTitle: "Contact Search",
        phoneDescription: "Department and staff contacts",
        campusTipsTitle: "Campus Tips",
        campusTipsDescription: "Useful links for school life",
        gymTitle: "Sports Facilities",
        gymDescription: "Gym and sports center info",
        healthCenterTitle: "Health Center",
        healthCenterDescription: "Student medical services",
      },
    },
    more: {
      title: "More",
      description: "Explore additional features",
      translationTitle: "Language Notice",
      translationDescription:
        "The interface supports English in beta. School source data such as notices, cafeteria menus, course names, and department names may still appear in Korean.",
      menus: {
        serviceTitle: "Service Notices",
        serviceDescription: "SYU CAMPUS service updates",
        meetTitle: "Schedule Poll",
        meetDescription: "Find available times with an invite link",
        privacyTitle: "Notifications and Privacy",
        privacyDescription: "Notification permissions and analytics guide",
      },
    },
    categories: {
      academicSchedule: "Academic Schedule",
      academicAnnouncement: "Academic Notices",
      campusAnnouncement: "Campus Notices",
      scholarship: "Scholarships",
      phoneNumbers: "Contacts",
      academic: "Academic Notices",
      campus: "Campus",
      registration: "Course Registration",
      exam: "Exam",
      holiday: "Holiday",
      event: "Event",
    },
    labels: {
      pinned: "Pinned",
      important: "Important",
      notice: "Notice",
      phone: "Call",
      error: "Error",
      warning: "Warning",
      info: "Info",
      sahmyookUniversity: "Sahmyook University",
    },
    pages: {
      announcements: {
        allTitle: "All Notices",
        allDescription:
          "Browse academic, campus, and scholarship notices by newest first",
        allError: "Could not load notices. Please try again shortly.",
        academicTitle: "Academic Notices",
        academicDescription: "Check important academic notices",
        academicError:
          "Could not load academic notices. Please try again shortly.",
        campusTitle: "Campus Notices",
        campusDescription: "Check campus life and major notices",
        campusError: "Could not load campus notices. Please try again shortly.",
        listSearchPlaceholder: "Search by title or author...",
        foundItems: "items found",
        searchQuery: "query",
        empty: "No results found.",
      },
    },
  },
} as const;

export type Dictionary = (typeof dictionaries)[Locale];

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
