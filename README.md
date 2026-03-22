# 삼육대 캠퍼스 - Sangmyung University Campus Platform

> 삼육대학교 학생들을 위한 완벽한 통합 정보 플랫폼

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-Active-green.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)

## 🎯 프로젝트 개요

삼육대 캠퍼스는 학생들이 자주 사용하는 학사정보, 공지사항, 캠퍼스 생활 정보를 한 곳에서 빠르고 직관적으로 접근할 수 있는 현대적인 웹 플랫폼입니다.

### ✨ 핵심 특징

- **📱 현대적 UI/UX**: Toss, Socar 스타일의 직관적 디자인
- **🌐 완벽한 반응형**: 모바일, 태블릿, 데스크톱 최적화
- **⚡ 초고속 성능**: Next.js 14 + 최적화된 번들
- **🔍 강력한 통합검색**: 학사공지, 학사일정, 장학금, 캠퍼스공지, 연락처 한번에 검색
- **📲 PWA 지원**: 앱처럼 설치 가능, 오프라인 구동
- **📊 실시간 분석**: Vercel Analytics로 사용 패턴 추적
- **🛡️ 프라이버시 중심**: 로컬 스토리지만 사용, 서버 저장 없음

## 🛠 기술 스택

### Frontend

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.3
- **Styling**: Tailwind CSS 3.4
- **상태관리**: TanStack React Query 5.28
- **분석**: Vercel Analytics
- **UI Components**: Custom built components

### Core Libraries

- `react@18.3.1` - UI 라이브러리
- `react-dom@18.3.1` - DOM 바인딩
- `date-fns@3.0.0` - 날짜 유틸리티
- `clsx@2.1.0` - 클래스네임 유틸리티
- `axios@1.13.6` - HTTP 클라이언트
- `cheerio@1.0.0-rc.12` - HTML 파싱

### PWA & Performance

- **Service Worker**: 오프라인 지원, 캐싱 전략
- **Manifest**: 앱 설치 메타데이터
- **Icons**: 다양한 크기 (72x72 ~ 512x512)
- **Caching**: Network First, Cache First 혼합

## 📁 프로젝트 구조

```
syu-campus/
├── app/
│   ├── layout.tsx                 # Root layout (PWA, Analytics)
│   ├── page.tsx                   # 메인 대시보드
│   ├── globals.css                # 전역 스타일
│   ├── providers.tsx              # React Query + Service Worker
│   ├── components/                # 공유 컴포넌트
│   │   ├── Header.tsx             # 상단 네비게이션
│   │   ├── BottomNav.tsx          # 하단 네비게이션 (모바일)
│   │   ├── Card.tsx               # 콘텐츠 카드
│   │   ├── Container.tsx          # 레이아웃 컨테이너
│   │   ├── Badge.tsx              # 배지
│   │   ├── AnnouncementCard.tsx    # 공지사항 카드
│   │   ├── SearchBar.tsx          # 검색창
│   │   └── Skeleton.tsx           # 로딩 스켈레톤
│   ├── academic/                  # 학사 섹션
│   │   ├── page.tsx
│   │   ├── schedule/              # 학사일정
│   │   └── announcements/         # 학사공지
│   ├── campus/                    # 캠퍼스 섹션
│   │   ├── page.tsx
│   │   ├── cafeteria/             # 학식
│   │   ├── shuttle/               # 셔틀버스
│   │   ├── library/               # 도서관 열람실
│   │   └── announcements/         # 캠퍼스공지
│   ├── tuition/                   # 재정 섹션
│   │   ├── page.tsx
│   │   └── scholarship/           # 장학금
│   ├── admin/                     # 관리 섹션
│   │   └── directory/             # 전화번호부
│   ├── terms/                     # 이용약관
│   ├── privacy/                   # 개인정보처리방침
│   └── api/                       # API 라우트 (향후 사용)
├── lib/
│   ├── api.ts                    # 모든 데이터 페칭 함수
│   └── utils.ts                  # 유틸리티 함수
├── types/
│   └── index.ts                  # 타입 정의
├── public/
│   ├── data/                     # JSON 데이터 파일
│   │   ├── announcements-academic.json
│   │   ├── announcements-scholarship.json
│   │   ├── announcements-campus-life.json
│   │   ├── schedules-major.json
│   │   ├── phone-numbers.json
│   │   ├── shuttle-bus-schedule.json
│   │   ├── cafeteria-menu.json
│   │   └── library-reading-rooms.json
│   ├── images/                   # 앱 아이콘
│   ├── manifest.json             # PWA 메니페스트
│   └── sw.js                     # Service Worker
├── package.json
├── next.config.js
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

## 🚀 시작하기

### 필수 요구사항

- Node.js 18.17+ 이상
- npm 또는 yarn 패키지 관리자

### 1. 프로젝트 설정

```bash
# 저장소 클론
git clone https://github.com/singhic/syu-campus.git
cd syu-campus

# 의존성 설치
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속

### 3. 프로덕션 빌드

```bash
npm run build
npm start
```

### 4. 린팅 및 타입 체크

```bash
npm run lint
npm run type-check
```

## 📖 주요 기능

### 🏠 홈 대시보드

- 자주 사용하는 메뉴 (모의 수강신청, 학사일정, 학식 등)
- 오늘의 학식 정보
- 최신 공지사항 요약

### 📚 학사 정보

- **학사공지**: 교무처, 학생지원, 교육혁신 공지사항
- **학사일정**: 시험, 수강신청, 휴일, 행사 일정
- **공지사항 페이지네이션**: 최대 10페이지

### 🏫 캠퍼스 정보

- **학식**: 주간 메뉴, 영양정보
- **셔틀버스**: 4개 탭 (평일 월-목, 금요일, 방학 평일, 방학 금요일)
  - 실시간 다음 버스 강조 표시
  - 미운영 시간대 표시
- **도서관**: 실시간 열람실 좌석 현황
- **캠퍼스공지**: 학생지원처, 도서관, 학생식당 공지

### 💰 재정 정보

- **장학금**: 교내/외 장학금 정보 (988개 항목)

### 📞 연락처

- **부서별 전화번호**: 빠른 검색 및 전화 연결

### 🔍 통합 검색

모든 카테고리를 한 번에 검색:

- 학사공지
- 학사일정
- 캠퍼스공지
- 장학금
- 캠퍼스공지
- 전화번호

각 카테고리별로 구분선과 아이콘으로 명확히 표시

## 🎨 디자인 시스템

### 색상 팔레트

| 색상         | 사용 목적              | RGB     |
| ------------ | ---------------------- | ------- |
| Primary Blue | 주요 액션, 강조        | #3182F6 |
| Green        | 성공, 긍정             | #10B981 |
| Yellow       | 경고, 정보             | #F59E0B |
| Red          | 오류, 중요             | #EF4444 |
| Gray         | 배경, 텍스트, 비활성화 | #6B7280 |

### 반응형 레이아웃

| 화면크기 | 최소 폭 | 주요 특징                |
| -------- | ------- | ------------------------ |
| Mobile   | 360px   | 단일 열, 하단 네비       |
| Tablet   | 768px   | 2열 레이아웃             |
| Desktop  | 1024px  | 3열+ 레이아웃, 상단 네비 |
| Wide     | 1280px  | 최대 너비 제한           |

## 🔄 데이터 관리

### JSON 기반 데이터

`public/data/` 폴더의 JSON 파일:

```json
// 예: announcements-academic.json
[
  {
    "id": "notice-001",
    "title": "2024학년도 1학기 수강신청 안내",
    "content": "...",
    "category": "academic",
    "date": "2024-01-15",
    "author": "교무처",
    "views": 1250,
    "isImportant": true,
    "url": "https://..."
  }
]
```

### API 함수 구조

`lib/api.ts`의 모든 함수:

```typescript
export async function fetchAnnouncements(category?: string) {
  try {
    const response = await fetch("/data/announcements-academic.json", {
      next: { revalidate: 3600 }, // 1시간 캐시
    });
    return response.json();
  } catch (error) {
    console.error("Fetch failed:", error);
    return [];
  }
}
```

## 📱 PWA 구현

### 설치 방법

1. **PC (Chrome)**:
   - 주소창의 설치 아이콘 클릭
   - 또는 메뉴 → "앱 설치"

2. **Android**:
   - 메뉴 → "앱 설치" 또는 "홈 화면에 추가"

3. **iOS**:
   - 공유 버튼 → "홈 화면에 추가"

### 오프라인 지원

- Service Worker 자동 등록 (`app/providers.tsx`)
- Network First 전략: 네트워크 우선, 실패 시 캐시 사용
- 오프라인 상태에서도 이전에 본 정보 제공

### Service Worker 캐싱 전략

```javascript
// API 요청: Network First
// 정적 자산: Cache First
// 매니페스트/SW: 항상 최신 버전
```

## 📊 분석

### Vercel Analytics

- 자동 성능 측정 (Core Web Vitals)
- 사용자 상호작용 추적
- 대시보드: https://vercel.com/analytics

### 로컬 데이터

- 클라이언트 측 로컬 스토리지 사용
- 사용자 설정, 즐겨찾기 등만 저장
- 개인정보 전송 없음

## 📝 이용약관 & 개인정보처리방침

- **이용약관**: `/terms` 페이지
- **개인정보처리방침**: `/privacy` 페이지
- 서비스 이용 전 필독

## ✅ 구현된 기능

### 완료 ✓

- ✅ 메인 대시보드
- ✅ 학사공지 (435+개)
- ✅ 학사일정 (크롤링)
- ✅ 캠퍼스공지 (435+개)
- ✅ 셔틀버스 (시간대별, 실시간 강조)
- ✅ 학식 정보 (메뉴, 영양정보)
- ✅ 장학금 정보 (988+개)
- ✅ 도서관 실시간 API
- ✅ 전화번호부
- ✅ 통합 검색 (5개 카테고리)
- ✅ 반응형 디자인
- ✅ PWA 및 Service Worker
- ✅ Vercel Analytics
- ✅ 페이지네이션 (최대 10페이지)
- ✅ 이용약관 및 개인정보처리방침

### 개발 예정

- [ ] 사용자 계정 시스템
- [ ] 로그인 기능 (학번 기반)
- [ ] 개인화 대시보드
- [ ] 즐겨찾기 기능
- [ ] 알림 설정
- [ ] 다크 모드
- [ ] 다국어 지원 (영어, 중국어)
- [ ] 동아리 정보
- [ ] 취업 정보
- [ ] 증명서 발급
- [ ] 캐리어 센터 정보
- [ ] 시간표 작성기
- [ ] 성적 조회
- [ ] 수강신청 시뮬레이터 고도화

## 🔧 개발 가이드

### 새 페이지 추가

```bash
# 1. 폴더 생성
mkdir -p app/new-feature

# 2. page.tsx 작성
cat > app/new-feature/page.tsx << 'EOF'
import { Container } from "@/app/components/Container";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "새 기능",
  description: "새 기능 설명",
};

export default function NewFeaturePage() {
  return (
    <Container className="py-6 sm:py-8">
      <h1 className="text-3xl font-bold">새 기능</h1>
    </Container>
  );
}
EOF

# 3. BottomNav.tsx에 링크 추가
```

### 새 API 함수 작성

```typescript
// lib/api.ts
export async function fetchNewData() {
  try {
    const response = await fetch("/data/new-data.json", {
      next: { revalidate: 3600 },
    });
    return response.json();
  } catch (error) {
    console.error("Fetch failed:", error);
    return [];
  }
}
```

### 타입 정의

```typescript
// types/index.ts
export interface NewData {
  id: string;
  title: string;
  description: string;
  date: string;
}
```

## 🐛 문제 해결

### Service Worker가 등록되지 않음

- 개발자 도구 → Application → Service Workers 확인
- 콘솔에 "✓ Service Worker 등록 완료" 메시지 확인
- HTTPS 또는 localhost에서만 작동

### 데이터가 오래된 정보

- 네트워크 탭에서 캐시 확인
- `lib/api.ts`의 `revalidate` 값 확인 (초 단위)
- 페이지 새로고침 (Ctrl+F5 또는 Cmd+Shift+R)

### PWA 설치 불가

- HTTPS 연결 확인
- manifest.json 파일 존재 확인
- 브라우저 콘솔에 오류 메시지 확인

## 📞 지원 & 피드백

- **GitHub Issues**: 버그 보고 및 기능 제안
- **GitHub Discussions**: 일반적인 질문 및 토론
- **Repository**: https://github.com/singhic/syu-campus

## 📄 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능

```
Copyright (c) 2024 Singhic

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files...
```

## 🙏 감사의 말

- 삼육대학교 학생들의 피드백
- 모든 기여자들

## 📊 프로젝트 통계

- **언어**: TypeScript, CSS, JavaScript
- **코드라인**: 2,000+ (컴포넌트)
- **데이터**: 1,400+ 항목
- **빌드**: Next.js 14 최적화
- **성능**: Lighthouse 95+ 점수

---

마지막 업데이트: 2026년 3월 21일

# 디렉토리 이동

cd syu-campus

# 의존성 설치

npm install

````

### 2. 개발 서버 실행

```bash
npm run dev
````

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

### 3. 빌드

```bash
npm run build
npm start
```

## 📖 주요 기능

### 1. 홈 대시보드 (Home)

- 자주 사용하는 메뉴
- 오늘의 정보 위젯
- 공지사항 요약
- 학식 정보
- 시험 일정

### 2. 학사 정보 (Academic)

- 학사공지
- 학사일정 (시험, 수강신청 등)
- 학점조회
- 수강신청 시뮬레이터
- 학적 현황

### 3. 캠퍼스 정보 (Campus Life)

- 학식 (주간 메뉴, 영양정보, 알레르기 표시)
- 셔틀버스 (평일/주말 시간표)
- 편의시설 (개발 예정)
- 체육시설 (개발 예정)
- 도서관 (개발 예정)
- 보건소 (개발 예정)

### 4. 등록금 및 장학금 (Tuition)

- 등록금 일정 (개발 예정)
- 장학금 정보 (교내/외)
- 학자금 대출 (개발 예정)
- 환급 안내 (개발 예정)

### 5. 검색 (Global Search)

- 공지사항
- 학사일정
- 장학금
- 실시간 키워드 검색

## 🎨 디자인 원칙

### 색상 체계

- **Primary**: Blue (#3182F6) - 주요 액세스 및 강조
- **Success**: Green - 양수, 완료 상태
- **Warning**: Yellow - 주의, 정보
- **Error**: Red - 중요, 실패 상태
- **Neutral**: Gray - 배경, 텍스트

### 컴포넌트

- Card-based layout
- Rounded corners (12px)
- Subtle shadows
- Clear visual hierarchy
- Smooth transitions

### 레이아웃

- **Mobile First**: 360px 이상 지원
- **Tablet**: 768px 이상
- **Desktop**: 1024px 이상
- **Max Width**: 1280px (content)
- **Padding**: 4px 시스템

## 🔄 API 시뮬레이션

모든 API는 `/lib/api.ts`에 구현되어 있습니다:

```typescript
// 예: 공지사항 조회
async function fetchAnnouncements(category?: string) {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Mock 데이터 반환
      resolve(announcements);
    }, 500); // 네트워크 지연 시뮬레이션
  });
}
```

### 백엔드 연동 시 (TODO)

실제 백엔드를 연동할 때는 다음과 같이 수정하면 됩니다:

```typescript
export async function fetchAnnouncements(category?: string) {
  const response = await fetch(`/api/announcements?category=${category || ""}`);
  if (!response.ok) throw new Error("Failed to fetch");
  return response.json();
}
```

## 📱 PWA 설정

### 설치 가능한 웹 앱

1. 주소창의 설치 아이콘 클릭
2. 또는 더보기 메뉴 → "앱 설치"
3. 또는 브라우저에서 "홈 화면에 추가"

### Service Worker

- 오프라인 지원
- 자동 캐싱 (Network First / Cache First)
- 백그라운드 동기화 (개발 예정)

### 시스템 알림 (개발 예정)

- 중요 공지사항 알림
- 수강신청 시간 안내
- 셔틀버스 도착 알림

## ✅ 구현된 기능

- ✅ 홈 대시보드
- ✅ 학사 섹션 (일정, 공지, 성적, 수강신청 UI)
- ✅ 캠퍼스 섹션 (학식, 셔틀버스)
- ✅ 등록금 섹션 (장학금)
- ✅ 전역 검색
- ✅ 반응형 디자인
- ✅ PWA 지원
- ✅ Mock API

## 🚧 구현 예정 (TODO)

- [ ] 도서관 운영시간 및 좌석 정보
- [ ] 편의시설 위치맵
- [ ] 체육시설 예약 시스템
- [ ] 동아리 정보 및 신청
- [ ] 학생회 활동
- [ ] 캐리어 및 취업 정보
- [ ] 증명서 발급 신청
- [ ] 학번별 연락처 검색
- [ ] 실시간 알림 (Push Notification)
- [ ] 다크 모드
- [ ] 다국어 지원
- [ ] 로그인 시스템
- [ ] 개인화 (즐겨찾기, 최근 본 항목)
- [ ] 백엔드 API 연동

## 🔧 유지보수

### 의존성 업데이트

```bash
npm update
```

### 린팅 및 타입 체크

```bash
npm run lint
npm run type-check
```

### 성능 최적화

- 이미지 최적화 (Next.js Image 컴포넌트)
- 코드 분할 (Dynamic Import)
- 번들 크기 분석

## 📝 개발 가이드

### 새 페이지 추가

1. `app/` 아래 폴더 생성
2. `page.tsx` 파일 작성
3. `app/components/BottomNav.tsx`에 네비게이션 링크 추가

### 새 Mock 데이터 추가

1. `data/` 폴더에 JSON 파일 생성
2. `lib/api.ts`에 fetch 함수 작성
3. `types/index.ts`에 TypeScript 타입 정의

### 컴포넌트 만들기

```typescript
// app/components/MyComponent.tsx
'use client';

import React from 'react';

export function MyComponent() {
  return (
    <div>
      {/* 컴포넌트 내용 */}
    </div>
  );
}

export default MyComponent;
```

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이센스

이 프로젝트는 삼육대학교 학생들을 위해 개발되었습니다.

## 📞 연락처

문제가 있거나 기능 요청이 있으시면 이슈를 등록해주세요.

---

**Made with ❤️ for Sangmyung University Students**
