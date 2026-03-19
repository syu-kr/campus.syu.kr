export function getFeatures() {
  return [
    {
      category: "학사",
      items: [
        "학사공지",
        "학사일정 (수강신청, 시험 등)",
        "학점조회",
        "수강신청 시뮬레이터",
        "졸업요건 체크리스트",
        "휴학/복학 신청",
      ],
    },
    {
      category: "캠퍼스",
      items: [
        "주간 학식 (조식, 중식, 석식)",
        "알레르기 정보",
        "셔틀버스 시간표 (평일/주말)",
        "편의시설 위치",
        "체육시설 정보",
        "도서관 운영시간",
        "보건소 안내",
      ],
    },
    {
      category: "등록금",
      items: [
        "등록금 납부 기간",
        "교내/외 장학금 정보",
        "학자금 대출 안내",
        "수강포기 환급 정책",
        "장학금 신청 기간",
      ],
    },
    {
      category: "행정",
      items: [
        "증명서 발급 신청",
        "학생증 재발급",
        "부서 연락처 검색",
        "교수 정보 검색",
        "학과 정보",
      ],
    },
    {
      category: "학생활동",
      items: [
        "학생회 소식",
        "동아리 목록 및 신청",
        "동아리 리뷰 및 평가",
        "행사 정보",
      ],
    },
    {
      category: "검색",
      items: [
        "전체 통합 검색",
        "공지사항 검색",
        "학사일정 검색",
        "장학금 검색",
        "시설 위치 검색",
      ],
    },
  ];
}

export function getUXPrinciples() {
  return [
    "최소 1-2 클릭으로 원하는 정보 접근",
    "명확한 시각적 계층 구조",
    "빠른 로딩 속도",
    "일관된 디자인 언어",
    "직관적인 네비게이션",
    "모바일 우선 반응형 디자인",
    "명확한 CTA (Call-to-Action)",
    "토스/쏘카 스타일의 현대적 디자인",
  ];
}

export function getColorScheme() {
  return {
    primary: {
      50: "#f0f7ff",
      100: "#e0effe",
      200: "#c7e0fd",
      300: "#a3cbfc",
      400: "#7eb3f9",
      500: "#3182F6",
      600: "#2563eb",
      700: "#1d4ed8",
      800: "#1e40af",
      900: "#1e3a8a",
    },
    neutral: {
      0: "#FFFFFF",
      50: "#f9fafb",
      100: "#f3f4f6",
      200: "#e5e7eb",
      300: "#d1d5db",
      400: "#9ca3af",
      500: "#6b7280",
      600: "#4b5563",
      700: "#374151",
      800: "#1f2937",
      900: "#111827",
    },
    success: {
      main: "#10b981",
      light: "#d1fae5",
    },
    warning: {
      main: "#f59e0b",
      light: "#fef3c7",
    },
    error: {
      main: "#ef4444",
      light: "#fee2e2",
    },
  };
}

export function getTypography() {
  return {
    fontFamily: [
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      '"Helvetica Neue"',
      "Arial",
      "sans-serif",
    ].join(", "),
    sizes: {
      xs: "12px",
      sm: "14px",
      md: "16px",
      lg: "18px",
      xl: "20px",
      "2xl": "24px",
      "3xl": "30px",
    },
    weights: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  };
}

export function getSpacingScale() {
  return {
    0: "0",
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    5: "20px",
    6: "24px",
    8: "32px",
    10: "40px",
    12: "48px",
    16: "64px",
  };
}
