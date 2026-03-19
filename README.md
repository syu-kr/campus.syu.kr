# 삼육대 캠퍼스 - Sangmyung University Campus Platform

> 삼육대학교 학생들을 위한 통합 정보 플랫폼

## 🎯 프로젝트 개요

삼육대 캠퍼스는 학생들이 자주 사용하는 학사정보, 공지사항, 학식 정보 등을 한 곳에서 빠르고 직관적으로 접근할 수 있는 현대적인 웹 플랫폼입니다.

### 주요 특징

- ✨ **Toss/Socar 스타일의 현대적 디자인**: 간결하고 직관적인 UI/UX
- 📱 **완벽한 반응형 디자인**: 모바일, 태블릿, 데스크톱 모두 지원
- ⚡ **빠른 성능**: Next.js와 최적화된 이미지 로딩
- 🔍 **강력한 검색 기능**: 전체 콘텐츠 통합 검색
- 🏃 **최소한의 네비게이션**: 1~2 클릭으로 정보 접근
- 📱 **PWA 지원**: 오프라인 기능 및 앱처럼 설치 가능

## 🛠 기술 스택

### Frontend

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **UI Components**: Custom components

### Data

- **Mock Data**: JSON 파일 기반
- **API Simulation**: 비동기 함수로 구현된 가짜 API
- **Latency Simulation**: 500-1000ms 딜레이

### PWA

- **Service Worker**: 오프라인 지원
- **Manifest**: 앱 설치 메타데이터
- **Icons**: 다양한 크기의 앱 아이콘

## 📁 프로젝트 구조

```
syu-campus/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Home page
│   ├── globals.css              # Global styles
│   ├── components/              # Core components
│   │   ├── Header.tsx
│   │   ├── BottomNav.tsx
│   │   ├── Card.tsx
│   │   ├── Container.tsx
│   │   ├── Badge.tsx
│   │   ├── AnnouncementCard.tsx
│   │   ├── SearchBar.tsx
│   │   └── Skeleton.tsx
│   ├── academic/                # Academic section
│   │   ├── page.tsx
│   │   ├── schedule/
│   │   ├── announcements/
│   │   ├── grades/
│   │   └── registration/
│   ├── campus/                  # Campus life section
│   │   ├── page.tsx
│   │   ├── cafeteria/
│   │   └── shuttle/
│   ├── tuition/                 # Tuition section
│   │   ├── page.tsx
│   │   └── scholarship/
│   ├── announcements/           # Announcements page
│   └── more/                    # Additional menu page
├── lib/                         # Utilities
│   ├── api.ts                  # Mock API functions
│   └── utils.ts                # Helper functions
├── data/                        # Mock data files
│   ├── announcements.json
│   ├── cafeteria.json
│   ├── schedule.json
│   ├── shuttle-bus.json
│   └── scholarships.json
├── types/                       # TypeScript types
│   └── index.ts
├── public/                      # Static assets
│   ├── manifest.json           # PWA manifest
│   └── sw.js                   # Service Worker
├── package.json
├── next.config.js
├── tsconfig.json
├── tailwind.config.js
└── postcss.config.js
```

## 🚀 시작하기

### 1. 설치

```bash
# 프로젝트 클론
git clone <repository-url>

# 디렉토리 이동
cd syu-campus

# 의존성 설치
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

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
