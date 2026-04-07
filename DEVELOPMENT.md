# 개발 가이드

SYU CAMPUS의 완전한 개발 가이드입니다. 설정, 아키텍처, API 연동, 배포를 다룹니다.

## 목차

1. [빠른 시작](#빠른-시작)
2. [프로젝트 구조](#프로젝트-구조)
3. [아키텍처](#아키텍처)
4. [API 연동](#api-연동)
5. [배포](#배포)
6. [기여하기](#기여하기)

## 빠른 시작

### 필수 요구사항

- Node.js 18.17 이상
- npm 또는 yarn 패키지 관리자
- Git

### 설치

```bash
# 저장소 복제
git clone https://github.com/singhic/syu-campus.git
cd syu-campus

# 의존성 설치
npm install

# 환경 설정
cp .env.example .env.local
# .env.local 파일을 열어 API 키 설정

# 개발 서버 실행
npm run dev
```

[http://localhost:3000](http://localhost:3000)을 열어주세요.

### 사용 가능한 스크립트

```bash
npm run dev           # 개발 서버 시작 (포트 3000)
npm run build         # 프로덕션 빌드
npm start             # 프로덕션 서버 시작
npm run lint          # ESLint 실행
npm run type-check    # TypeScript 타입 체크
```

## 프로젝트 구조

```
syu-campus/
├── app/                           # Next.js 14 App Router
│   ├── api/                       # API 라우트
│   │   ├── bus/                   # 셔틀버스 데이터
│   │   ├── library/               # 도서관 데이터
│   │   ├── weather/               # 날씨 데이터
│   │   ├── notifications/         # 알림 엔드포인트
│   │   └── service-notices/       # 공지사항
│   │
│   ├── components/                # 공유 컴포넌트
│   │   ├── Header.tsx
│   │   ├── BottomNav.tsx
│   │   ├── Card.tsx
│   │   ├── Container.tsx
│   │   ├── Badge.tsx
│   │   ├── AnnouncementCard.tsx
│   │   ├── SearchBar.tsx
│   │   ├── Skeleton.tsx
│   │   ├── WeatherWidget.tsx
│   │   └── WeatherModal.tsx
│   │
│   ├── academic/                  # 학사 섹션
│   │   ├── page.tsx
│   │   ├── announcements/
│   │   ├── schedule/
│   │   ├── graduation/
│   │   └── timetable/
│   │
│   ├── campus/                    # 캠퍼스 섹션
│   │   ├── page.tsx
│   │   ├── announcements/
│   │   ├── cafeteria/
│   │   ├── gym/
│   │   ├── health-center/
│   │   ├── library/
│   │   ├── map/
│   │   └── shuttle/
│   │
│   ├── more/                      # 추가 기능
│   │   ├── page.tsx
│   │   ├── phone/
│   │   └── scholarship/
│   │
│   ├── privacy/                   # 개인정보처리방침
│   ├── terms/                     # 이용약관
│   │
│   ├── layout.tsx                 # 루트 레이아웃
│   ├── page.tsx                   # 홈 페이지
│   ├── globals.css                # 전역 스타일
│   ├── providers.tsx              # React Query + Service Worker 설정
│   └── not-found.tsx              # 404 페이지
│
├── lib/                           # 유틸리티 및 API 클라이언트
│   ├── api.ts                     # 데이터 페칭 및 변경 함수
│   ├── cache-version.ts           # 캐시 버전 관리
│   ├── firebase.ts                # Firebase 클라이언트 설정
│   ├── firebaseAdmin.ts           # Firebase 관리자 설정
│   ├── graduation.ts              # 졸업 요건 계산 로직
│   ├── serviceNotices.ts          # 공지사항 유틸리티
│   ├── use-versioned-query.ts     # React Query 커스텀 훅
│   ├── utils.ts                   # 헬퍼 함수
│   └── weather.ts                 # 날씨 유틸리티
│
├── components/                    # 루트 레벨 컴포넌트
│   ├── NotificationModal.tsx
│   └── WeatherWidget.tsx
│
├── types/                         # TypeScript 타입 정의
│   └── index.ts
│
├── public/                        # 정적 자산
│   ├── data/                      # JSON 데이터 파일
│   │   ├── announcements-*.json
│   │   ├── cafeteria-menu.json
│   │   ├── graduation-requirements.json
│   │   ├── library-reading-rooms.json
│   │   ├── phone-numbers.json
│   │   ├── schedules-major.json
│   │   └── shuttle-bus-schedule.json
│   │
│   ├── manifest.json              # PWA 매니페스트
│   ├── robots.txt                 # SEO robots 파일
│   ├── sitemap.xml                # XML 사이트맵
│   ├── sw.js                      # Service Worker
│   ├── docs/                      # 문서 파일
│   ├── images/                    # 이미지 및 아이콘
│   └── service-notices/           # 공지사항 마크다운 파일
│
├── scripts/                       # 유틸리티 스크립트
│   ├── send-daily-notification.ts # 일일 알림 스케줄러
│   └── cleanup_old_tokens.ts      # 토큰 정리 작업
│
├── .github/workflows/             # GitHub Actions
│   └── daily-announcement-notification.yml
│
├── DEVELOPMENT.md                 # 이 파일
├── package.json
├── next.config.js
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── vercel.json                    # Vercel 배포 설정
├── .env.example                   # 환경변수 예제
└── README.md                      # 프로젝트 개요
```

## 아키텍처

### 기술 스택

**프론트엔드**

- Next.js 14 (App Router)
- TypeScript 5.3
- React 18.3
- Tailwind CSS 3.4
- TanStack React Query 5.28
- Firebase SDK 12.11

**백엔드 및 서비스**

- Next.js API Routes
- Firebase 실시간 데이터베이스
- Firebase Cloud Messaging
- Firebase Admin SDK 13.7

**외부 API**

- 기상청 날씨 API
- Kakao Maps API

**DevOps**

- Vercel (호스팅)
- GitHub Actions (CI/CD)
- Firebase (백엔드 서비스)

### 데이터 흐름

```
사용자 (클라이언트)
    ↓
Next.js 페이지 (SSR/CSR)
    ↓
React 컴포넌트 + TanStack Query
    ↓
API Routes (Next.js API)
    ↓
외부 API / Firebase / JSON 데이터
```

### 상태 관리

- **서버 상태**: TanStack React Query
- **로컬 상태**: React 훅 (useState, useReducer)
- **실시간 데이터**: Firebase 실시간 데이터베이스
- **전역 상태**: React Context (필요시)

### 캐싱 전략

- **JSON 데이터**: 1시간마다 재검증 (컴포넌트 레벨 60초)
- **날씨 데이터**: 최대 55초 캐시 + 시간 변경시 수동 무효화
- **Firebase**: 캐싱을 활용한 실시간 리스너
- **Service Worker**: 네트워크 우선 전략, 캐시로 폴백

## API 연동

### 환경 변수

`.env.example`을 `.env.local`로 복사하고 설정하세요:

```env
# Kakao Maps
NEXT_PUBLIC_KAKAO_MAP_KEY=카카오_맵_API_키

# 공공데이터포털 (날씨, 버스 등)
NEXT_PUBLIC_PUBLIC_DATA_SERVICE_KEY=공공데이터포털_서비스_키

# Firebase (클라이언트)
NEXT_PUBLIC_FIREBASE_API_KEY=파이어베이스_API_키
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=프로젝트-이름.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=프로젝트-ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=프로젝트.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=메시징-센더-ID
NEXT_PUBLIC_FIREBASE_APP_ID=앱-ID
NEXT_PUBLIC_FIREBASE_VAPID_KEY=VAPID-공개키

# Firebase (서버)
FIREBASE_ADMIN_SDK_KEY=base64_인코딩_JSON
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

### 제3자 API

#### 1. 날씨 API (기상청)

**엔드포인트**: 기상청 날씨 API

캠퍼스 위치(구리시, 경기도)의 시간별 날씨 업데이트 제공

```typescript
// lib/weather.ts
interface WeatherData {
  temp: number; // 섭씨 온도
  sky: string; // 하늘 상태
  pty: number; // 강수 형태
  updateTime: string; // 업데이트 시간 (HH:MM 형식)
}

export async function fetchWeather(): Promise<WeatherData>;
```

**주요 고려사항**:

- UTC 경계에서 매시간 업데이트
- 한국 시간(UTC+9)으로 변환해서 표시
- 최대 55초 캐시, 시간 변경시 수동 무효화
- 새로운 시간(KST)에만 다시 페칭

#### 2. Kakao Maps API

**엔드포인트**: Kakao Maps SDK

40개 이상 건물로 된 캠퍼스 지도 표시 및 실시간 셔틀 추적

```typescript
// app/campus/map/page.tsx
interface MapMarker {
  id: string;
  name: string;
  lat: number;
  lon: number;
  floors?: Record<string, string[]>;
}
```

**기능**:

- 건물 검색 기능
- 층별 시설 정보
- 실시간 버스 위치 마커
- 노선별 색상 구분

#### 3. 셔틀버스 실시간 API

**엔드포인트**: `POST http://nexmotion.co.kr/bus/busStatusList.php`

실시간 셔틀버스 위치 추적

```typescript
// app/campus/shuttle/page.tsx
interface BusLocation {
  id: string;
  name: string;
  lat: string;
  lon: string;
  status: number; // 0: 미운영, 1: 학교→역, 2: 역→학교
  routeid: number; // 1, 2, 또는 3
}
```

**폴링**: 5-10초 (랜덤 간격)

**노선 ID 매핑**:

- 1: 화랑대역 (파란색)
- 2: 석계역 (초록색)
- 3: 별내역 (주황색)

#### 4. Firebase 서비스

**실시간 데이터베이스**:

- 알림
- 사용자 설정
- 임시 데이터

**Cloud Messaging**:

- 푸시 알림
- 일일 공지사항
- 긴급 알림

**인증**:

- 익명 로그인 (추적용)
- 이메일/비밀번호 (향후)

### API 라우트 만들기

```typescript
// app/api/example/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // 로직 작성
    return NextResponse.json({ data: [] });
  } catch (error) {
    return NextResponse.json({ error: "내부 서버 오류" }, { status: 500 });
  }
}
```

### 데이터 페칭 패턴

**클라이언트 쪽 React Query 사용**:

```typescript
// lib/api.ts
import { useQuery } from '@tanstack/react-query';

export function useAnnouncements() {
  return useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const response = await fetch('/data/announcements.json');
      return response.json();
    },
    staleTime: 3600000, // 1시간
  });
}

// 컴포넌트에서
export function MyComponent() {
  const { data, isLoading } = useAnnouncements();
  if (isLoading) return <Skeleton />;
  return <div>{/* 데이터 렌더링 */}</div>;
}
```

## 배포

### 배포 전 체크리스트

- [ ] 모든 테스트 통과
- [ ] TypeScript 컴파일 성공
- [ ] 환경 변수 설정 완료
- [ ] 빌드 결과물 생성됨
- [ ] 콘솔 오류/경고 없음
- [ ] 성능 지표 만족
- [ ] SEO 메타데이터 설정됨

### Vercel 배포

1. **저장소 연결**
   - [Vercel](https://vercel.com) 방문
   - GitHub 저장소 임포트
   - "syu-campus" 프로젝트 선택

2. **환경 설정**
   - Settings → Environment Variables 이동
   - `.env.local`의 모든 변수 추가
   - `NEXT_PUBLIC_*` 변수는 "Exposed to Browser Client"로 표시

3. **배포**
   - main 브랜치에 푸시하면 자동 배포
   - PR에 대한 스테이징 배포
   - Vercel 대시보드에서 배포 로그 확인

4. **커스텀 도메인**
   ```
   Vercel 대시보드 → Domains → 추가
   DNS CNAME 레코드 설정
   ```

### GitHub Actions 배포

일일 공지사항 알림은 스케줄에 따라 실행됩니다:

```yaml
# .github/workflows/daily-announcement-notification.yml
schedule:
  - cron: "0 23 * * *" # 08:00 KST (23:00 UTC)
```

**필요한 Secrets**:

- `FIREBASE_SERVICE_ACCOUNT`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `PUSH_API_KEY`
- `API_URL`

### 성능 최적화

**이미지 최적화**

- Next.js Image 컴포넌트 사용
- 자동 형식 변환 (WebP)
- 반응형 이미지 제공

**코드 분할**

```typescript
import dynamic from 'next/dynamic';

const Modal = dynamic(() => import('./Modal'), {
  loading: () => <Skeleton />,
});
```

**번들 분석**

```bash
npm install -D @next/bundle-analyzer
# next.config.js에서 설정
```

## 기여하기

### 코드 스타일

**TypeScript**

- Strict 모드 활성화
- 완전한 타입 주석 필수
- `any` 타입 금지 (필요시 `unknown` 사용)

**React 컴포넌트**

- 훅을 사용한 함수형 컴포넌트
- Props 인터페이스 정의 필수
- PropTypes 또는 TS 인터페이스 필수

**스타일링**

- Tailwind CSS 유틸리티만 사용
- 필요한 경우 제외하고 CSS-in-JS 미사용
- 디자인 토큰 사용 (색상, 간격)

**Git**

- 기능 브랜치: `feature/설명`
- 버그 수정: `fix/설명`
- 형식: `타입/짧은-설명`
- 원자적 커밋 + 명확한 메시지

### Pull Request 절차

1. 기능 브랜치 생성
2. 명확한 커밋으로 변경사항 작성
3. 테스트 확인: `npm run build && npm run type-check`
4. PR 제목과 설명 작성 (설명적으로)
5. 관련 이슈 연결
6. 팀원에게 검토 요청
7. 피드백 반영
8. 승인 후 병합

### 코드 리뷰 체크리스트

- [ ] TypeScript 오류 없음
- [ ] console.log나 디버그 코드 없음
- [ ] 테스트 통과 (있는 경우)
- [ ] 성능 저하 없음
- [ ] 프로젝트 규정 준수
- [ ] 필요시 문서 업데이트
- [ ] 커밋 원자적이고 설명적

## 문제 해결

### 흔한 문제

**1. Service Worker가 등록되지 않음**

```
해결책:
- HTTPS 연결 확인 (localhost는 가능)
- 브라우저 캐시 초기화
- public/ 폴더에 sw.js 확인
- 콘솔에 오류 메시지 확인
```

**2. Firebase 초기화 오류**

```
해결책:
- 모든 FIREBASE_* 환경변수 확인
- .env.local 파일 존재 확인
- 환경변수 변경 후 개발 서버 재시작
- Firebase 프로젝트 설정 확인
```

**3. 날씨 API 레이트 제한**

```
해결책:
- 적절한 캐싱 구현 (55초)
- API 키 로테이션
- API 제공자에 할당량 증가 요청
- 폴백 날씨 데이터 구현
```

**4. 빌드 실패**

```
해결책:
npm run type-check  # TypeScript 오류 찾기
npm run lint        # 린팅 문제 찾기
npm run build       # 전체 빌드 테스트
```

### 도움 받기

- **GitHub Issues**: 버그 보고 및 기능 요청
- **GitHub Discussions**: 개발 관련 질문
- **문서**: DEVELOPMENT.md 및 코드 주석
- **팀**: PR 토론에서 기여자에게 문의

---

**최종 업데이트**: 2026년 4월 2일

질문이나 문제사항은 상세한 내용과 함께 GitHub 이슈를 작성해주세요.
