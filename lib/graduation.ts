/**
 * 삼육대학교 졸업이수요건 데이터 (2026년 기준)
 *
 * 공식 출처:
 *   https://www.syu.ac.kr/academic/academic-info/graduation/
 *   각 학과별 공식 웹사이트 졸업요건 페이지
 *
 * 마지막 검수: 2026-03-31
 *
 * 구조:
 * - COLLEGES: 5개 대학
 * - DEPARTMENTS: 학과 정보 (대학별)
 * - MAJORS: 학과 내 전공 정보 (필요시)
 * - GRADUATION_REQUIREMENTS: 학과별 졸업요건 상세
 * - TRANSFER_STUDENT_CREDITS: 편입생/전과생 졸업학점
 */

// ─────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────

export interface College {
  id: string;
  name: string;
  description: string;
}

export interface Department {
  id: string;
  name: string;
  collegeId: string;
  majors?: Major[];
  url?: string;
}

export interface Major {
  id: string;
  name: string;
  deptId: string;
}

// 새로운 구조 (향후 사용)
export interface GraduationProfileV2 {
  collegeId: string;
  deptId: string;
  majorId?: string;
  admissionType: string; // 신입, 2학년편입, 3학년편입, 4학년편입, 전과-1학년, 전과-2학년, 전과-3학년, 전과-4학년
  admissionYear: string;
  hasDoubleMinor?: boolean;
  hasTeachingCertificate?: boolean;
}

// 기존 구조 (호환성 유지)
export interface GraduationProfile {
  admissionType: string;
  admissionYear: string;
  dept: string;
  majorType: string;
  transferStudentTiming?: string;
}

// ─────────────────────────────────────────────────────
// 1. 대학 (College) 정보
// ─────────────────────────────────────────────────────

export const COLLEGES: Record<string, College> = {
  theology: {
    id: "theology",
    name: "신학대학",
    description: "신학 및 종교 관련 학과",
  },
  nursing: {
    id: "nursing",
    name: "간호대학",
    description: "간호학 및 보건 관련 학과",
  },
  pharmacy: {
    id: "pharmacy",
    name: "약학대학",
    description: "약학 관련 학과",
  },
  creative_fusion: {
    id: "creative_fusion",
    name: "창의융합대학",
    description: "인문, 사회과학, 예술 분야 학과",
  },
  future_fusion: {
    id: "future_fusion",
    name: "미래융합대학",
    description: "공학, 과학, 기술 분야 학과",
  },
};

// ─────────────────────────────────────────────────────
// 2. 학과 (Department) 정보
// ─────────────────────────────────────────────────────

export const DEPARTMENTS_BY_COLLEGE: Record<string, Department> = {
  // 신학대학
  theology_dept: {
    id: "theology_dept",
    name: "신학과",
    collegeId: "theology",
    url: "https://www.syu.ac.kr/theo/",
  },

  // 간호대학
  nursing_nursing: {
    id: "nursing_nursing",
    name: "간호학과",
    collegeId: "nursing",
    url: "https://www.syu.ac.kr/nursing/",
  },

  // 약학대학
  pharmacy_pharm: {
    id: "pharmacy_pharm",
    name: "약학과",
    collegeId: "pharmacy",
    url: "https://www.syu.ac.kr/pharmacy/",
  },

  // 창의융합대학
  cf_business: {
    id: "cf_business",
    name: "경영학과",
    collegeId: "creative_fusion",
    url: "https://www.syu.ac.kr/doba/",
  },
  cf_korean: {
    id: "cf_korean",
    name: "글로벌한국학과",
    collegeId: "creative_fusion",
    url: "https://www.syu.ac.kr/gks/",
  },
  cf_socialwelfare: {
    id: "cf_socialwelfare",
    name: "사회복지학과",
    collegeId: "creative_fusion",
    url: "https://www.syu.ac.kr/sw/",
  },
  cf_counseling: {
    id: "cf_counseling",
    name: "상담심리학과",
    collegeId: "creative_fusion",
    url: "https://www.syu.ac.kr/couns/",
  },
  cf_artdesign: {
    id: "cf_artdesign",
    name: "아트앤디자인학과",
    collegeId: "creative_fusion",
    url: "https://www.syu.ac.kr/arts/",
  },
  cf_english: {
    id: "cf_english",
    name: "영어영문학과",
    collegeId: "creative_fusion",
    url: "https://www.syu.ac.kr/english/",
  },
  cf_earlychildhood: {
    id: "cf_earlychildhood",
    name: "유아교육과",
    collegeId: "creative_fusion",
    url: "https://www.syu.ac.kr/ece/",
  },
  cf_music: {
    id: "cf_music",
    name: "음악학과",
    collegeId: "creative_fusion",
    url: "https://www.syu.ac.kr/music/",
  },
  cf_physical: {
    id: "cf_physical",
    name: "체육학과",
    collegeId: "creative_fusion",
    url: "https://www.syu.ac.kr/hhp/",
  },
  cf_aviation: {
    id: "cf_aviation",
    name: "항공관광외국어학부",
    collegeId: "creative_fusion",
    majors: [
      {
        id: "aviation_oriental",
        name: "동양어문화전공",
        deptId: "cf_aviation",
      },
      { id: "aviation_tourism", name: "항공관광전공", deptId: "cf_aviation" },
    ],
    url: "https://www.syu.ac.kr/atfl/",
  },

  // 미래융합대학
  ff_architecture: {
    id: "ff_architecture",
    name: "건축학과",
    collegeId: "future_fusion",
    majors: [
      { id: "arch_4year", name: "4년제", deptId: "ff_architecture" },
      { id: "arch_5year", name: "5년제", deptId: "ff_architecture" },
    ],
    url: "https://www.syu.ac.kr/arch/",
  },
  ff_animal: {
    id: "ff_animal",
    name: "동물자원과학과",
    collegeId: "future_fusion",
    url: "https://www.syu.ac.kr/aas/",
  },
  ff_datacloud: {
    id: "ff_datacloud",
    name: "데이터클라우드공학과",
    collegeId: "future_fusion",
    url: "https://www.syu.ac.kr/dce/",
  },
  ff_physicaltherapy: {
    id: "ff_physicaltherapy",
    name: "물리치료학과",
    collegeId: "future_fusion",
    url: "https://www.syu.ac.kr/pt/",
  },
  ff_healthadmin: {
    id: "ff_healthadmin",
    name: "보건관리학과",
    collegeId: "future_fusion",
    url: "https://www.syu.ac.kr/syuhealth/",
  },
  ff_foodnutrition: {
    id: "ff_foodnutrition",
    name: "식품영양학과",
    collegeId: "future_fusion",
    url: "https://www.syu.ac.kr/fn/",
  },
  ff_ai: {
    id: "ff_ai",
    name: "인공지능융합학부",
    collegeId: "future_fusion",
    majors: [
      { id: "ai_bis", name: "경영정보시스템전공", deptId: "ff_ai" },
      { id: "ai_eng", name: "인공지능공학전공", deptId: "ff_ai" },
      { id: "ai_semi", name: "지능형반도체전공", deptId: "ff_ai" },
    ],
    url: "https://www.syu.ac.kr/aice/",
  },
  ff_computer: {
    id: "ff_computer",
    name: "컴퓨터공학부",
    collegeId: "future_fusion",
    majors: [
      { id: "cs_cs", name: "컴퓨터공학전공", deptId: "ff_computer" },
      { id: "cs_sw", name: "소프트웨어전공", deptId: "ff_computer" },
    ],
    url: "https://www.syu.ac.kr/cse/",
  },
  ff_chemistry: {
    id: "ff_chemistry",
    name: "화학생명과학과",
    collegeId: "future_fusion",
    url: "https://www.syu.ac.kr/chem/",
  },
  ff_envdesign: {
    id: "ff_envdesign",
    name: "환경디자인원예학과",
    collegeId: "future_fusion",
    url: "https://www.syu.ac.kr/envdh/",
  },
};

export interface RequiredCredits {
  totalCredits: number;
  majorCredits: number | null;
  chapelCount: number;
}

export interface CheckItem {
  id: string;
  label: string;
  group: string;
}

// ─────────────────────────────────────────────────────
// 1. 기초교양 필수 — 학번별 (신입생 전용, 편입생 해당없음)
// ─────────────────────────────────────────────────────
export const BASIC_LIBERAL_BY_COHORT = {
  "2022이후": [
    { name: "그린교육(노작교육)", credits: 1, pf: true },
    { name: "지역사회공헌(사회봉사)", credits: 1, pf: true },
    { name: "사고와 표현", credits: 3 },
    { name: "글로컬영어 I", credits: 3 },
    { name: "글로컬영어 II", credits: 3 },
    { name: "인생설계와 진로 I", credits: 1, pf: true },
    { name: "인생설계와 진로 II", credits: 1, pf: true },
    { name: "컴퓨팅사고력(AI 리터러시와 문제해결)", credits: 3, pf: true },
  ],
  "2018~2021": [
    { name: "그린교육(노작교육)", credits: 1, pf: true },
    { name: "지역사회공헌(사회봉사)", credits: 1, pf: true },
    { name: "글로컬사고와 표현", credits: 3 },
    { name: "글로컬영어 I", credits: 3 },
    { name: "글로컬영어 II", credits: 3 },
    { name: "인생설계와 진로 I", credits: 1, pf: true },
    { name: "인생설계와 진로 II", credits: 1, pf: true },
    { name: "컴퓨팅사고력", credits: 3, pf: true },
  ],
  "2017": [
    { name: "그린교육(노작교육)", credits: 1, pf: true },
    { name: "지역사회공헌(사회봉사)", credits: 1, pf: true },
    { name: "독서와토론", credits: 2 },
    { name: "글쓰기", credits: 2 },
    { name: "실용영어 I", credits: 3 },
    { name: "실용영어 II", credits: 3 },
    { name: "인생설계와 진로 I", credits: 1, pf: true },
    { name: "인생설계와 진로 II", credits: 1, pf: true },
    { name: "컴퓨팅사고력", credits: 3, pf: true },
  ],
  "2016": [
    { name: "그린교육(노작교육)", credits: 1, pf: true },
    { name: "지역사회공헌(사회봉사)", credits: 1, pf: true },
    { name: "독서와토론", credits: 2 },
    { name: "글쓰기", credits: 2 },
    { name: "실용영어 I", credits: 3 },
    { name: "실용영어 II", credits: 3 },
    { name: "인생설계와 진로 I", credits: 1, pf: true },
    { name: "인생설계와 진로 II", credits: 1, pf: true },
    { name: "컴퓨터활용(MOS) 택2", credits: 0 },
  ],
  "2015": [
    { name: "그린교육(노작교육)", credits: 1, pf: true },
    { name: "지역사회공헌(사회봉사)", credits: 1, pf: true },
    { name: "독서와토론", credits: 2 },
    { name: "글쓰기", credits: 1 },
    { name: "실용영어 I", credits: 3 },
    { name: "실용영어 II", credits: 3 },
    { name: "컴퓨터활용(MOS) 택2", credits: 0 },
  ],
};

// 호환성: 2022학번 이후 기본 교양필수
export const BASIC_LIBERAL = BASIC_LIBERAL_BY_COHORT["2022이후"];

// ─────────────────────────────────────────────────────
// 2. 핵심교양 I — 1·2학년 4과목, 편입생 해당없음
// ─────────────────────────────────────────────────────
export const CORE_LIBERAL = {
  required: [
    { name: "인성과 사회", credits: 2 },
    { name: "종교와 인생", credits: 2 },
    { name: "생활과 윤리", credits: 2 },
    { name: "역사와 문화", credits: 2 },
  ],
  optional: [{ name: "인성영역 교양 (3~4학년)", credits: 3 }],
};

// 호환성: 기존 이름
export const CORE1 = CORE_LIBERAL.required;
export const CORE_LIBERAL_1 = CORE_LIBERAL.required;
export const CORE_LIBERAL_2 = CORE_LIBERAL.optional;

// ─────────────────────────────────────────────────────
// 2-1. 편입생 인성교양 — 편입학년별로 다름
// ─────────────────────────────────────────────────────
export const TRANSFER_PERSONAL_LIBERAL = {
  "2학년편입": 2, // 2과목 (6학점)
  "3학년편입": 2, // 2과목 (6학점)
  "4학년편입": 1, // 1과목 (3학점)
};

// ─────────────────────────────────────────────────────
// 3. 영역별 교양 선택 (각 영역 1과목씩 필수)
// ─────────────────────────────────────────────────────
export const AREA_LIBERAL = [
  { id: "area_hum", name: "인문예술 영역", credits: 3 },
  { id: "area_soc", name: "사회과학 영역", credits: 3 },
  { id: "area_sci", name: "자연과학 영역", credits: 3 },
  { id: "area_dig", name: "디지털리터러시 영역", credits: 3 },
];

// ─────────────────────────────────────────────────────
// 4. 채플 요구사항
// ─────────────────────────────────────────────────────
export const CHAPEL = {
  신입: 7,
  "2학년편입": 5,
  "3학년편입": 3,
  "4학년편입": 1,
};

// ─────────────────────────────────────────────────────
// 5. 신입학생 졸업학점 기준 (공식 정보 기반)
// ─────────────────────────────────────────────────────
export const NEW_STUDENT_CREDITS = {
  일반학과: {
    단일전공: { 졸업: 130, 교필: 24, 영역필수: 15, 주전공: 75, 자유: 16 },
    복수전공: {
      졸업: 130,
      교필: 24,
      영역필수: 15,
      주전공: 39,
      복연: 36,
      자유: 16,
    },
    부전공: { 졸업: 130, 교필: 24, 영역필수: 15, 주전공: 54, 부: 21, 자유: 16 },
    교직: {
      졸업: 130,
      교필: 24,
      영역필수: 15,
      주전공: 50,
      교직: 22,
      자유: 19,
    },
    평생교육사: {
      졸업: 130,
      교필: 24,
      영역필수: 15,
      주전공: 54,
      평교: 30,
      자유: 7,
    },
  },
  컴퓨터공학부: {
    단일전공: { 졸업: 140, 교필: 24, 영역필수: 15, 주전공: 85, 자유: 16 },
    복수전공: {
      졸업: 140,
      교필: 24,
      영역필수: 15,
      주전공: 49,
      복연: 36,
      자유: 16,
    },
  },
  인공지능융합학부: {
    단일전공: { 졸업: 140, 교필: 24, 영역필수: 15, 주전공: 85, 자유: 16 },
    복수전공: {
      졸업: 140,
      교필: 24,
      영역필수: 15,
      주전공: 49,
      복연: 36,
      자유: 16,
    },
  },
  빅데이터클라우드공학과: {
    단일전공: { 졸업: 140, 교필: 24, 영역필수: 15, 주전공: 85, 자유: 16 },
    복수전공: {
      졸업: 140,
      교필: 24,
      영역필수: 15,
      주전공: 49,
      복연: 36,
      자유: 16,
    },
  },
  "건축학과(5년제)": {
    단일전공: { 졸업: 158, 교필: 24, 영역필수: 15, 주전공: 119 },
  },
  약학과: {
    단일전공: { 졸업: 240, 교필: 24, 영역필수: 15, 주전공: 201 },
  },
  간호학과: {
    단일전공: { 졸업: 150, 교필: 18, 영역필수: 12, 주전공: 120 },
  },
};

// ─────────────────────────────────────────────────────
// 6. 3학년 편입생 졸업학점 기준
// ─────────────────────────────────────────────────────
export const TRANSFER3_CREDITS = {
  일반학과: {
    단일전공: { 졸업: 68, 교필: 6, 주전공: 51 },
    복수전공: { 졸업: 68, 교필: 6, 주전공: 39, 복연: 36 },
    부전공: { 졸업: 68, 교필: 6, 주전공: 51, 부: 21 },
  },
  컴퓨터공학부: {
    단일전공: { 졸업: 72, 교필: 6, 주전공: 61 },
    복수전공: { 졸업: 72, 교필: 6, 주전공: 49, 복연: 36 },
  },
  인공지능융합학부: {
    단일전공: { 졸업: 72, 교필: 6, 주전공: 61 },
    복수전공: { 졸업: 72, 교필: 6, 주전공: 49, 복연: 36 },
  },
  빅데이터클라우드공학과: {
    단일전공: { 졸업: 72, 교필: 6, 주전공: 61 },
    복수전공: { 졸업: 72, 교필: 6, 주전공: 49, 복연: 36 },
  },
  "건축학과(5년제)": {
    단일전공: { 졸업: 102, 교필: 6, 주전공: 86 },
  },
  간호학과: {
    단일전공: { 졸업: 78, 교필: 6, 주전공: 72 },
  },
};

// ─────────────────────────────────────────────────────
// 7. 4학년 편입생 졸업학점 기준 (유치원교사양성, 의료인력양성만)
// ─────────────────────────────────────────────────────
export const TRANSFER4_CREDITS = {
  일반학과: {
    단일전공: { 졸업: 34, 교필: 3, 주전공: 21 },
    복수전공: { 졸업: 34, 교필: 3, 주전공: 21, 복연: 36 },
    부전공: { 졸업: 34, 교필: 3, 주전공: 21, 부: 21 },
  },
  간호학과: {
    단일전공: { 졸업: 42, 교필: 3, 주전공: 39 },
  },
};

// ─────────────────────────────────────────────────────
// 8. 전과생 졸업학점 기준
// ─────────────────────────────────────────────────────
export const TRANSFER_STUDENT_CREDITS = {
  일반학과: {
    "1학년2학기": {
      단일: { 졸업: 130, 교필: 24, 주전공: 75 },
      복수: { 졸업: 130, 교필: 24, 주전공: 39 },
      부전공: { 졸업: 130, 교필: 24, 주전공: 54 },
    },
    "2학년": {
      단일: { 졸업: 130, 교필: 24, 주전공: 63 },
      복수: { 졸업: 130, 교필: 24, 주전공: 39 },
      부전공: { 졸업: 130, 교필: 24, 주전공: 54 },
    },
    "3학년": {
      단일: { 졸업: 130, 교필: 24, 주전공: 51 },
      복수: { 졸업: 130, 교필: 24, 주전공: 39 },
      부전공: { 졸업: 130, 교필: 24, 주전공: 51 },
    },
    "4학년": {
      단일: { 졸업: 130, 교필: 24, 주전공: 51 },
      복수: { 졸업: 130, 교필: 24, 주전공: 39 },
      부전공: { 졸업: 130, 교필: 24, 주전공: 51 },
    },
  },
  컴퓨터공학부: {
    "1학년2학기": {
      단일: { 졸업: 140, 교필: 24, 주전공: 85 },
      복수: { 졸업: 140, 교필: 24, 주전공: 49 },
    },
    "2학년": {
      단일: { 졸업: 140, 교필: 24, 주전공: 73 },
      복수: { 졸업: 140, 교필: 24, 주전공: 49 },
    },
    "3학년": {
      단일: { 졸업: 140, 교필: 24, 주전공: 61 },
      복수: { 졸업: 140, 교필: 24, 주전공: 49 },
    },
    "4학년": {
      단일: { 졸업: 140, 교필: 24, 주전공: 61 },
      복수: { 졸업: 140, 교필: 24, 주전공: 49 },
    },
  },
  인공지능융합학부: {
    "1학년2학기": {
      단일: { 졸업: 140, 교필: 24, 주전공: 85 },
      복수: { 졸업: 140, 교필: 24, 주전공: 49 },
    },
    "2학년": {
      단일: { 졸업: 140, 교필: 24, 주전공: 73 },
      복수: { 졸업: 140, 교필: 24, 주전공: 49 },
    },
    "3학년": {
      단일: { 졸업: 140, 교필: 24, 주전공: 61 },
      복수: { 졸업: 140, 교필: 24, 주전공: 49 },
    },
    "4학년": {
      단일: { 졸업: 140, 교필: 24, 주전공: 61 },
      복수: { 졸업: 140, 교필: 24, 주전공: 49 },
    },
  },
  빅데이터클라우드공학과: {
    "1학년2학기": {
      단일: { 졸업: 140, 교필: 24, 주전공: 85 },
      복수: { 졸업: 140, 교필: 24, 주전공: 49 },
    },
    "2학년": {
      단일: { 졸업: 140, 교필: 24, 주전공: 73 },
      복수: { 졸업: 140, 교필: 24, 주전공: 49 },
    },
    "3학년": {
      단일: { 졸업: 140, 교필: 24, 주전공: 61 },
      복수: { 졸업: 140, 교필: 24, 주전공: 49 },
    },
    "4학년": {
      단일: { 졸업: 140, 교필: 24, 주전공: 61 },
      복수: { 졸업: 140, 교필: 24, 주전공: 49 },
    },
  },
  "건축학과(5년제)": {
    "1학년2학기": { 단일: { 졸업: 158, 교필: 24, 주전공: 119 } },
    "2학년": { 단일: { 졸업: 158, 교필: 24, 주전공: 119 } },
    "3학년": { 단일: { 졸업: 158, 교필: 24, 주전공: 119 } },
    "4학년": { 단일: { 졸업: 158, 교필: 24, 주전공: 119 } },
  },
  간호학과: {
    "1학년2학기": { 단일: { 졸업: 150, 교필: 18, 주전공: 120 } },
    "2학년": { 단일: { 졸업: 150, 교필: 18, 주전공: 108 } },
    "3학년": { 단일: { 졸업: 150, 교필: 18, 주전공: 96 } },
    "4학년": { 단일: { 졸업: 150, 교필: 18, 주전공: 96 } },
  },
};

// ─────────────────────────────────────────────────────
// 호환성: 기존 상수명과 계산 헬퍼
// ─────────────────────────────────────────────────────
export const TOTAL_CREDITS = {
  신입_일반: 130,
  신입_컴퓨터공학부등: 140,
  신입_건축학과5년제: 158,
  신입_약학과6년제: 240,
  신입_간호학과: 150,
  "3학년편입_일반": 68,
  "3학년편입_컴퓨터공학부등": 72,
  "3학년편입_건축학과5년제": 102,
  "3학년편입_간호학과": 78,
  "4학년편입_일반": 34,
  "4학년편입_간호학과": 42,
};

// ─────────────────────────────────────────────────────
// 검증 함수
// ─────────────────────────────────────────────────────

/** 학번 유효성 검증 (2000~현재년도 범위) */
export function isValidAdmissionYear(year: string): boolean {
  if (!year || year.length !== 4 || !/^\d+$/.test(year)) return false;
  const yr = parseInt(year, 10);
  const currentYear = new Date().getFullYear();
  return yr >= 2000 && yr <= currentYear;
}

/** 학번별 기초교양 코호트 분류 */
export function getBasicLiberalCohort(admissionYear: number): string {
  if (admissionYear >= 2022) return "2022이후";
  if (admissionYear >= 2018) return "2018~2021";
  if (admissionYear === 2017) return "2017";
  if (admissionYear === 2016) return "2016";
  if (admissionYear === 2015) return "2015";
  return "2022이후";
}

/** 학과 그룹 분류: 호환성용 */
function getDeptGroupCompat(
  dept: string,
): "일반" | "컴퓨터공학부등" | "건축학과5년제" | "약학과6년제" | "간호학과" {
  const cseDepts = [
    "인공지능융합학부",
    "컴퓨터공학부",
    "빅데이터클라우드공학과",
  ];
  if (cseDepts.includes(dept)) return "컴퓨터공학부등";
  if (dept === "건축학과(5년제)") return "건축학과5년제";
  if (dept === "약학과") return "약학과6년제";
  if (dept === "간호학과") return "간호학과";
  return "일반";
}

/** 해당 학과에서 전공 유형이 가능한지 검증 (편입생/전과생은 교직/평생교육사 제외) */
export function hasMajorType(
  majorType: string,
  dept: string,
  admissionType?: string,
): boolean {
  const deptGroup = getDeptGroupCompat(dept);
  const isTransferOrStudent =
    admissionType?.includes("편입") || admissionType?.startsWith("전과");

  // 편입생/전과생은 교직/평생교육사 불가
  if (
    isTransferOrStudent &&
    (majorType === "교직" || majorType === "평생교육사")
  ) {
    return false;
  }

  // 교직과정은 일반학과만 가능
  if (majorType === "교직") {
    return deptGroup === "일반";
  }

  // 평생교육사는 일반학과만 가능
  if (majorType === "평생교육사") {
    return deptGroup === "일반";
  }

  // 컴퓨터공학부 계열은 단일/복수/부전공만 (교직, 평생교육사 불가)
  if (deptGroup === "컴퓨터공학부등") {
    return (
      majorType === "단일전공" ||
      majorType === "복수전공" ||
      majorType === "부전공"
    );
  }

  // 건축학과/약학과/간호학과는 단일전공만 가능
  if (
    deptGroup === "건축학과5년제" ||
    deptGroup === "약학과6년제" ||
    deptGroup === "간호학과"
  ) {
    return majorType === "단일전공";
  }

  return true;
}

/** 신입생 기준 졸업학점 조회 */
export function getNewStudentRequiredCredits(
  majorType: string,
  dept: string,
): { 졸업: number; 교필: number; 영역필수?: number } | null {
  const credits = NEW_STUDENT_CREDITS[dept as keyof typeof NEW_STUDENT_CREDITS];
  if (!credits) return null;

  const majorKey = majorType as keyof typeof credits;
  const data = credits[majorKey];

  if (!data) return null;

  return {
    졸업: data.졸업,
    교필: data.교필,
    영역필수: data.영역필수 ?? undefined,
  };
}

/** 3학년편입 기준 졸업학점 조회 */
export function getTransfer3RequiredCredits(
  majorType: string,
  dept: string,
): { 졸업: number; 교필: number } | null {
  const credits = TRANSFER3_CREDITS[dept as keyof typeof TRANSFER3_CREDITS];
  if (!credits) return null;

  const majorKey = majorType as keyof typeof credits;
  const data = credits[majorKey];

  if (!data) return null;

  return {
    졸업: data.졸업,
    교필: data.교필,
  };
}

/** 호환성: 기존 함수명 */
export function getRequiredCredits(
  type: string,
  admissionYear: number,
  dept: string,
): number {
  const cseDepts = [
    "인공지능융합학부",
    "컴퓨터공학부",
    "빅데이터클라우드공학과",
  ];

  if (type === "신입생") {
    if (dept === "약학과") return TOTAL_CREDITS["신입_약학과6년제"];
    if (dept === "건축학과(5년제)") return TOTAL_CREDITS["신입_건축학과5년제"];
    if (cseDepts.includes(dept) && admissionYear >= 2022)
      return TOTAL_CREDITS["신입_컴퓨터공학부등"];
    return TOTAL_CREDITS["신입_일반"];
  }

  if (type === "3학년편입") {
    if (dept === "건축학과(5년제)")
      return TOTAL_CREDITS["3학년편입_건축학과5년제"];
    if (cseDepts.includes(dept) && admissionYear >= 2022)
      return TOTAL_CREDITS["3학년편입_컴퓨터공학부등"];
    return TOTAL_CREDITS["3학년편입_일반"];
  }

  if (type === "4학년편입") return TOTAL_CREDITS["4학년편입_일반"];
  if (type === "외국인유학생") return TOTAL_CREDITS["신입_일반"];

  return TOTAL_CREDITS["신입_일반"];
}

/** 전과생 졸업학점 조회 */
export function getTransferStudentRequiredCredits(
  majorType: string,
  dept: string,
  timing: string,
): { 졸업: number; 교필: number } | null {
  const deptData =
    TRANSFER_STUDENT_CREDITS[dept as keyof typeof TRANSFER_STUDENT_CREDITS];
  if (!deptData) return null;

  const timingData = deptData[timing as keyof typeof deptData];
  if (!timingData) return null;

  // 전공 유형에 따라 다른 키 사용
  let majorKey: string;
  if (majorType === "단일전공") majorKey = "단일";
  else if (majorType === "복수전공") majorKey = "복수";
  else if (majorType === "부전공") majorKey = "부전공";
  else majorKey = "단일";

  const data = timingData[majorKey as keyof typeof timingData];
  if (!data) return null;

  return {
    졸업: data.졸업,
    교필: data.교필,
  };
}

/** 호환성: 기존 함수명 */
export function getMajorCredits(
  majorType: string,
  admissionType: string,
  dept: string,
): number | null {
  if (admissionType === "신입생" || admissionType === "외국인유학생") {
    const credits =
      NEW_STUDENT_CREDITS[dept as keyof typeof NEW_STUDENT_CREDITS];
    if (!credits) return null;
    const majorKey = majorType as keyof typeof credits;
    const data = credits[majorKey];
    return data ? data.주전공 : null;
  }

  if (admissionType === "3학년편입") {
    const credits = TRANSFER3_CREDITS[dept as keyof typeof TRANSFER3_CREDITS];
    if (!credits) return null;
    const majorKey = majorType as keyof typeof credits;
    const data = credits[majorKey];
    return data ? data.주전공 : null;
  }

  return null;
}

/** 입학유형별 채플 횟수 */
export function getChapelCount(admissionType: string): number {
  if (admissionType === "신입생" || admissionType === "외국인유학생")
    return CHAPEL["신입"];
  if (admissionType === "2학년편입") return CHAPEL["2학년편입"];
  if (admissionType === "3학년편입") return CHAPEL["3학년편입"];
  if (admissionType === "4학년편입") return CHAPEL["4학년편입"];
  // 전과생: 신입생과 동일 (7회)
  if (admissionType.startsWith("전과")) return CHAPEL["신입"];
  return CHAPEL["신입"];
}

/** 체크리스트 항목 생성 */
export function buildCheckItems(
  profile: GraduationProfile,
  req: RequiredCredits | null,
): CheckItem[] {
  if (!req) return [];

  const isTransfer = ["2학년편입", "3학년편입", "4학년편입"].includes(
    profile.admissionType,
  );
  const isTransferStudent = profile.admissionType.startsWith("전과");

  const items: CheckItem[] = [];

  // 학점 관련
  items.push({
    id: "totalCredits",
    label: `졸업이수학점 (${req.totalCredits}학점)`,
    group: "학점",
  });

  if (req.majorCredits) {
    items.push({
      id: "majorCredits",
      label: `주전공 학점 (${req.majorCredits}학점)`,
      group: "학점",
    });
  }

  // 교양: 신입생 & 전과생 (동일)
  if (!isTransfer) {
    items.push({
      id: "basicLiberal",
      label: "기초교양필수 전체 이수",
      group: "교양",
    });

    // 핵심교양 I - 과목별 상세 표시
    items.push({
      id: "coreLiberalInsinsung",
      label: "인성과 사회 (2학점)",
      group: "교양",
    });
    items.push({
      id: "coreLiberalReligion",
      label: "종교와 인생 (2학점)",
      group: "교양",
    });
    items.push({
      id: "coreLiberalEthics",
      label: "생활과 윤리 (2학점)",
      group: "교양",
    });
    items.push({
      id: "coreLiberalHistory",
      label: "역사와 문화 (2학점)",
      group: "교양",
    });

    items.push({
      id: "areaLiberal",
      label: "영역별 교양 (4개영역/12학점)",
      group: "교양",
    });

    items.push({
      id: "coreLiberal2",
      label: "인성영역 교양 (1과목/3학점)",
      group: "교양",
    });
  } else if (isTransfer) {
    // 편입생: 인성교양만 필수
    const personalLiberalCount =
      TRANSFER_PERSONAL_LIBERAL[
        profile.admissionType as keyof typeof TRANSFER_PERSONAL_LIBERAL
      ] || 1;

    items.push({
      id: "personalLiberal",
      label: `인성교양 (${personalLiberalCount}과목/${personalLiberalCount * 3}학점)`,
      group: "교양",
    });
  }

  // 채플
  items.push({
    id: "chapel",
    label: `채플 이수 (${req.chapelCount}회)`,
    group: "졸업조건",
  });

  // 흡연음주예방교육 (신입생만)
  if (!isTransfer && !isTransferStudent) {
    items.push({
      id: "smoking",
      label: "흡연음주예방교육 (1회)",
      group: "졸업조건",
    });
  }

  return items;
}

// ─────────────────────────────────────────────
// 선택 목록 상수
// ─────────────────────────────────────────────
export const ADMISSION_TYPES = [
  "신입생",
  "외국인유학생",
  "2학년편입",
  "3학년편입",
  "4학년편입",
  "전과-1학년",
  "전과-2학년",
  "전과-3학년",
  "전과-4학년",
];

export const DEPARTMENTS = [
  "일반학과",
  "약학과",
  "건축학과(5년제)",
  "인공지능융합학부",
  "컴퓨터공학부",
  "빅데이터클라우드공학과",
];

export const TRANSFER_STUDENT_TIMING = [
  "1학년2학기",
  "2학년",
  "3학년",
  "4학년",
];

export const MAJOR_TYPES = [
  "단일전공",
  "복수전공",
  "부전공",
  "교직",
  "평생교육사",
];

// ─────────────────────────────────────────────────────
// 9. 학과별 졸업요건 상세 정보 (웹 크롤링 기반)
// ─────────────────────────────────────────────────────

export interface GraduationRequirement {
  id: string;
  name: string;
  college: string;
  hasExam?: boolean;
  examName?: string;
  totalCredits: number;
  majorCredits: number;
  notes?: string;
  url?: string;
  majors?: {
    id: string;
    name: string;
    totalCredits: number;
    majorCredits: number;
  }[];
}

/**
 * 학과별 졸업요건 (2026년 기준)
 * 출처: 각 대학/학과 공식 웹사이트
 */
export const GRADUATION_REQUIREMENTS: Record<string, GraduationRequirement> = {
  // 신학대학
  theology_dept: {
    id: "theology_dept",
    name: "신학과",
    college: "신학대학",
    hasExam: false,
    totalCredits: 130,
    majorCredits: 36,
    notes: "졸업요건: 총 130학점 이상, 전공 36학점 이상",
    url: "https://www.syu.ac.kr/theo/",
  },

  // 간호대학
  nursing_nursing: {
    id: "nursing_nursing",
    name: "간호학과",
    college: "간호대학",
    hasExam: true,
    examName: "간호사 자격시험",
    totalCredits: 150,
    majorCredits: 60,
    notes: "간호사 자격시험 응시 자격 필수. 입학유형별로 졸업학점 상이",
    url: "https://www.syu.ac.kr/nursing/",
  },

  // 약학대학
  pharmacy_pharm: {
    id: "pharmacy_pharm",
    name: "약학과",
    college: "약학대학",
    hasExam: true,
    examName: "약사 자격시험",
    totalCredits: 150,
    majorCredits: 120,
    notes: "약사 자격시험 응시 필수. 6년제 제도",
    url: "https://www.syu.ac.kr/pharmacy/",
  },

  // 창의융합대학
  cf_business: {
    id: "cf_business",
    name: "경영학과",
    college: "창의융합대학",
    hasExam: false,
    totalCredits: 130,
    majorCredits: 30,
    notes: "졸업요건: 총 130학점 이상, 전공 30학점 이상",
    url: "https://www.syu.ac.kr/doba/",
  },

  cf_korean: {
    id: "cf_korean",
    name: "글로벌한국학과",
    college: "창의융합대학",
    hasExam: false,
    totalCredits: 130,
    majorCredits: 36,
    notes: "졸업요건: 총 130학점 이상, 전공 36학점 이상",
    url: "https://www.syu.ac.kr/gks/",
  },

  cf_socialwelfare: {
    id: "cf_socialwelfare",
    name: "사회복지학과",
    college: "창의융합대학",
    hasExam: false,
    totalCredits: 130,
    majorCredits: 42,
    notes: "졸업요건: 총 130학점 이상, 전공 42학점 이상",
    url: "https://www.syu.ac.kr/sw/",
  },

  cf_counseling: {
    id: "cf_counseling",
    name: "상담심리학과",
    college: "창의융합대학",
    hasExam: false,
    totalCredits: 130,
    majorCredits: 39,
    notes: "졸업요건: 총 130학점 이상, 전공 39학점 이상",
    url: "https://www.syu.ac.kr/couns/",
  },

  cf_artdesign: {
    id: "cf_artdesign",
    name: "아트앤디자인학과",
    college: "창의융합대학",
    hasExam: false,
    totalCredits: 130,
    majorCredits: 42,
    notes: "졸업요건: 총 130학점 이상, 전공 42학점 이상",
    url: "https://www.syu.ac.kr/arts/",
  },

  cf_english: {
    id: "cf_english",
    name: "영어영문학과",
    college: "창의융합대학",
    hasExam: false,
    totalCredits: 130,
    majorCredits: 36,
    notes: "졸업요건: 총 130학점 이상, 전공 36학점 이상",
    url: "https://www.syu.ac.kr/english/",
  },

  cf_earlychildhood: {
    id: "cf_earlychildhood",
    name: "유아교육과",
    college: "창의융합대학",
    hasExam: false,
    totalCredits: 130,
    majorCredits: 45,
    notes: "졸업요건: 총 130학점 이상, 전공 45학점 이상, 현장실습 필수",
    url: "https://www.syu.ac.kr/ece/",
  },

  cf_music: {
    id: "cf_music",
    name: "음악학과",
    college: "창의융합대학",
    hasExam: false,
    totalCredits: 130,
    majorCredits: 42,
    notes: "졸업요건: 총 130학점 이상, 전공 42학점 이상",
    url: "https://www.syu.ac.kr/music/",
  },

  cf_physical: {
    id: "cf_physical",
    name: "체육학과",
    college: "창의융합대학",
    hasExam: false,
    totalCredits: 130,
    majorCredits: 42,
    notes: "졸업요건: 총 130학점 이상, 전공 42학점 이상",
    url: "https://www.syu.ac.kr/hhp/",
  },

  cf_aviation: {
    id: "cf_aviation",
    name: "항공관광외국어학부",
    college: "창의융합대학",
    hasExam: false,
    majors: [
      {
        id: "aviation_oriental",
        name: "동양어문화전공",
        totalCredits: 130,
        majorCredits: 42,
      },
      {
        id: "aviation_tourism",
        name: "항공관광전공",
        totalCredits: 130,
        majorCredits: 42,
      },
    ],
    totalCredits: 130,
    majorCredits: 42,
    notes: "졸업요건: 총 130학점 이상, 전공 42학점 이상",
    url: "https://www.syu.ac.kr/atfl/",
  },

  // 미래융합대학
  ff_architecture: {
    id: "ff_architecture",
    name: "건축학과",
    college: "미래융합대학",
    hasExam: true,
    examName: "건축사 시험",
    majors: [
      {
        id: "arch_4year",
        name: "4년제",
        totalCredits: 130,
        majorCredits: 54,
      },
      {
        id: "arch_5year",
        name: "5년제",
        totalCredits: 160,
        majorCredits: 80,
      },
    ],
    totalCredits: 160,
    majorCredits: 80,
    notes: "5년제는 건축사 시험 응시 자격 취득",
    url: "https://www.syu.ac.kr/arch/",
  },

  ff_animal: {
    id: "ff_animal",
    name: "동물자원과학과",
    college: "미래융합대학",
    hasExam: false,
    totalCredits: 130,
    majorCredits: 42,
    notes: "졸업요건: 총 130학점 이상, 전공 42학점 이상",
    url: "https://www.syu.ac.kr/aas/",
  },

  ff_datacloud: {
    id: "ff_datacloud",
    name: "데이터클라우드공학과",
    college: "미래융합대학",
    hasExam: false,
    totalCredits: 140,
    majorCredits: 42,
    notes: "졸업요건: 총 140학점 이상, 전공 42학점 이상",
    url: "https://www.syu.ac.kr/dce/",
  },

  ff_physicaltherapy: {
    id: "ff_physicaltherapy",
    name: "물리치료학과",
    college: "미래융합대학",
    hasExam: true,
    examName: "물리치료사 자격시험",
    totalCredits: 140,
    majorCredits: 60,
    notes: "졸업요건: 총 140학점 이상, 전공 60학점 이상",
    url: "https://www.syu.ac.kr/pt/",
  },

  ff_healthadmin: {
    id: "ff_healthadmin",
    name: "보건관리학과",
    college: "미래융합대학",
    hasExam: false,
    totalCredits: 130,
    majorCredits: 39,
    notes: "졸업요건: 총 130학점 이상, 전공 39학점 이상",
    url: "https://www.syu.ac.kr/syuhealth/",
  },

  ff_foodnutrition: {
    id: "ff_foodnutrition",
    name: "식품영양학과",
    college: "미래융합대학",
    hasExam: true,
    examName: "식품영양사 자격시험",
    totalCredits: 130,
    majorCredits: 42,
    notes: "졸업요건: 총 130학점 이상, 전공 42학점 이상",
    url: "https://www.syu.ac.kr/fn/",
  },

  ff_ai: {
    id: "ff_ai",
    name: "인공지능융합학부",
    college: "미래융합대학",
    hasExam: false,
    majors: [
      {
        id: "ai_bis",
        name: "경영정보시스템전공",
        totalCredits: 140,
        majorCredits: 42,
      },
      {
        id: "ai_eng",
        name: "인공지능공학전공",
        totalCredits: 140,
        majorCredits: 42,
      },
      {
        id: "ai_semi",
        name: "지능형반도체전공",
        totalCredits: 140,
        majorCredits: 45,
      },
    ],
    totalCredits: 140,
    majorCredits: 42,
    notes: "졸업요건: 총 140학점 이상, 전공 42~45학점 이상",
    url: "https://www.syu.ac.kr/aice/",
  },

  ff_computer: {
    id: "ff_computer",
    name: "컴퓨터공학부",
    college: "미래융합대학",
    hasExam: false,
    majors: [
      {
        id: "cs_cs",
        name: "컴퓨터공학전공",
        totalCredits: 140,
        majorCredits: 42,
      },
      {
        id: "cs_sw",
        name: "소프트웨어전공",
        totalCredits: 140,
        majorCredits: 42,
      },
    ],
    totalCredits: 140,
    majorCredits: 42,
    notes: "졸업요건: 총 140학점 이상, 전공 42학점 이상",
    url: "https://www.syu.ac.kr/cse/",
  },

  ff_chemistry: {
    id: "ff_chemistry",
    name: "화학생명과학과",
    college: "미래융합대학",
    hasExam: false,
    totalCredits: 130,
    majorCredits: 40,
    notes: "졸업요건: 총 130학점 이상, 전공 40학점 이상",
    url: "https://www.syu.ac.kr/chem/",
  },

  ff_envdesign: {
    id: "ff_envdesign",
    name: "환경디자인원예학과",
    college: "미래융합대학",
    hasExam: false,
    totalCredits: 130,
    majorCredits: 42,
    notes: "졸업요건: 총 130학점 이상, 전공 42학점 이상",
    url: "https://www.syu.ac.kr/envdh/",
  },
};

/**
 * 대학 ID로 대학 정보 조회
 */
export function getCollegeById(collegeId: string): College | undefined {
  return COLLEGES[collegeId];
}

/**
 * 대학 ID로 해당 대학의 모든 학과 조회
 */
export function getDepartmentsByCollege(collegeId: string): Department[] {
  return Object.values(DEPARTMENTS_BY_COLLEGE).filter(
    (dept) => dept.collegeId === collegeId,
  );
}

/**
 * 학과 ID로 해당 학과의 전공 목록 조회 (없으면 undefined)
 */
export function getMajors(deptId: string): Major[] | undefined {
  const dept = DEPARTMENTS_BY_COLLEGE[deptId];
  return dept?.majors;
}

/**
 * 학과 및 전공 ID로 졸업요건 정보 조회
 */
export function getGraduationRequirements(
  deptId: string,
  majorId?: string,
):
  | GraduationRequirement
  | { totalCredits: number; majorCredits: number }
  | undefined {
  const req = GRADUATION_REQUIREMENTS[deptId];
  if (!req) return undefined;

  // 전공이 있는 학과 (ff_architecture, ff_ai, ff_computer, cf_aviation)
  if (majorId && req.majors) {
    const major = req.majors.find((m) => m.id === majorId);
    if (major) {
      return {
        totalCredits: major.totalCredits,
        majorCredits: major.majorCredits,
      };
    }
  }

  // 전공이 선택되지 않았거나 존재하지 않으면 학과 전체 정보 반환
  return {
    totalCredits: req.totalCredits,
    majorCredits: req.majorCredits,
    notes: req.notes,
  };
}

/**
 * admissionType에 따라 다른 졸업학점을 반영한 정보 조회
 */
export function getGraduationRequirementsWithAdmission(
  deptId: string,
  admissionType: string,
  majorId?: string,
): {
  totalCredits: number;
  majorCredits: number;
  notes?: string;
} | null {
  const req = getGraduationRequirements(deptId, majorId);
  if (!req) return null;

  // 약학과는 신입생만 지원 (6년제 학사과정)
  const deptName = DEPARTMENTS_BY_COLLEGE[deptId]?.name || "";
  if (deptName === "약학과" && admissionType !== "신입생") {
    return null; // 편입/전과는 불가능
  }

  // 기본값: 신입생 기준
  const baseCredits = {
    totalCredits: req.totalCredits,
    majorCredits: req.majorCredits,
    notes: "notes" in req ? req.notes : undefined,
  };

  // 편입생 학점 조정
  if (admissionType === "2학년편입") {
    const transfer2 =
      TRANSFER3_CREDITS[deptName as keyof typeof TRANSFER3_CREDITS];
    if (transfer2) {
      return {
        ...baseCredits,
        totalCredits: transfer2["단일전공"]?.졸업 || baseCredits.totalCredits,
        majorCredits: transfer2["단일전공"]?.주전공 || baseCredits.majorCredits,
        notes: `2학년편입 기준: ${
          transfer2["단일전공"]?.졸업 || baseCredits.totalCredits
        }학점 이상 (전공 ${
          transfer2["단일전공"]?.주전공 || baseCredits.majorCredits
        }학점 이상)`,
      };
    }
  } else if (admissionType === "3학년편입") {
    const transfer3 =
      TRANSFER3_CREDITS[deptName as keyof typeof TRANSFER3_CREDITS];
    if (transfer3) {
      return {
        ...baseCredits,
        totalCredits: transfer3["단일전공"]?.졸업 || baseCredits.totalCredits,
        majorCredits: transfer3["단일전공"]?.주전공 || baseCredits.majorCredits,
        notes: `3학년편입 기준: ${
          transfer3["단일전공"]?.졸업 || baseCredits.totalCredits
        }학점 이상 (전공 ${
          transfer3["단일전공"]?.주전공 || baseCredits.majorCredits
        }학점 이상)`,
      };
    }
  } else if (admissionType === "4학년편입") {
    const transfer4 =
      TRANSFER4_CREDITS[deptName as keyof typeof TRANSFER4_CREDITS];
    if (transfer4) {
      return {
        ...baseCredits,
        totalCredits: transfer4["단일전공"]?.졸업 || baseCredits.totalCredits,
        majorCredits: transfer4["단일전공"]?.주전공 || baseCredits.majorCredits,
        notes: `4학년편입 기준: ${
          transfer4["단일전공"]?.졸업 || baseCredits.totalCredits
        }학점 이상 (전공 ${
          transfer4["단일전공"]?.주전공 || baseCredits.majorCredits
        }학점 이상)`,
      };
    }
  } else if (admissionType.startsWith("전과")) {
    // 전과생: 전과-1학년 -> "1학년2학기" 등으로 변환
    let timingKey = "1학년2학기";
    if (admissionType === "전과-2학년") timingKey = "2학년";
    else if (admissionType === "전과-3학년") timingKey = "3학년";
    else if (admissionType === "전과-4학년") timingKey = "4학년";

    const transferStudentData =
      TRANSFER_STUDENT_CREDITS[
        deptName as keyof typeof TRANSFER_STUDENT_CREDITS
      ];
    if (transferStudentData) {
      const timingData =
        transferStudentData[timingKey as keyof typeof transferStudentData];
      if (timingData) {
        const creditData = timingData["단일" as keyof typeof timingData];
        if (creditData) {
          return {
            ...baseCredits,
            totalCredits: creditData.졸업,
            majorCredits: creditData.주전공,
            notes: `전과-${timingKey === "1학년2학기" ? "1학년" : timingKey.charAt(0) + "학년"} 기준: ${creditData.졸업}학점 이상 (전공 ${creditData.주전공}학점 이상)`,
          };
        }
      }
    }
  }

  return baseCredits;
}

/** 학과에서 선택 가능한 입학유형 목록 조회 */
export function getAvailableAdmissionTypes(deptId: string): string[] {
  const available: string[] = [];

  // 모든 입학유형에 대해 졸업요건이 존재하는지 확인
  ADMISSION_TYPES.forEach((type) => {
    const req = getGraduationRequirementsWithAdmission(deptId, type);
    if (req !== null) {
      available.push(type);
    }
  });

  return available;
}
