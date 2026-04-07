# SYU CAMPUS

> 삼육대학교 학생들을 위한 통합 정보 플랫폼

[![라이선스: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-14+-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwind-css)](https://tailwindcss.com/)

## 주요 기능

- **현대적 UI/UX** - 토스, 쏘카 스타일의 직관적 카드 기반 디자인
- **빠른 성능** - Next.js 14으로 최적화된 속도
- **통합 검색** - 공지사항, 일정, 장학금, 연락처를 한 곳에서 검색
- **PWA 지원** - 앱처럼 설치 가능하며 오프라인 지원
- **완벽한 반응형** - 모바일, 태블릿, 데스크톱 모두 최적화
- **프라이버시 중심** - 로컬 스토리지만 사용, 서버 저장 없음
- **접근성** - WCAG 준수, 의미있는 HTML 구조
- **실시간 데이터** - 캠퍼스 셔틀버스 위치 추적 및 라이브 정보

## 빠른 시작

### 필수 요구사항

- Node.js 18 이상
- npm 또는 yarn

### 설치

```bash
# 저장소 복제
git clone https://github.com/singhic/syu-campus.git
cd syu-campus

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env.local

# 개발 서버 실행
npm run dev
```

[http://localhost:3000](http://localhost:3000)을 브라우저에서 열어주세요.

### 프로덕션 빌드

```bash
npm run build
npm start
```

## 문서

- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - 종합 개발 가이드 (설정, 아키텍처, API 연동)

## 기술 스택

### 프론트엔드

- **프레임워크**: [Next.js 14](https://nextjs.org/) - App Router 지원 React 프레임워크
- **언어**: [TypeScript 5.3](https://www.typescriptlang.org/) - 타입 안전 JavaScript
- **스타일링**: [Tailwind CSS 3.4](https://tailwindcss.com/) - 유틸리티 기반 CSS
- **상태 관리**: [TanStack Query 5.28](https://tanstack.com/query) - 서버 상태 관리
- **HTTP 클라이언트**: [Axios 1.13](https://axios-http.com/) - 프로미스 기반 HTTP 요청

### 백엔드 및 서비스

- **백엔드 API**: Next.js API Routes
- **실시간 데이터**: Firebase 실시간 데이터베이스
- **푸시 알림**: Firebase Cloud Messaging
- **날씨 데이터**: 기상청 날씨 API
- **지도 서비스**: Kakao Maps API (캠퍼스 셔틀 실시간 추적)

### DevOps

- **호스팅**: Vercel
- **CI/CD**: GitHub Actions
- **버전 관리**: Git + GitHub

## 프로젝트 구조

```
syu-campus/
├── app/                           # Next.js App Router
│   ├── api/                       # API 라우트
│   ├── components/                # 공유 컴포넌트
│   ├── academic/                  # 학사 정보
│   ├── campus/                    # 캠퍼스 생활
│   ├── more/                      # 추가 기능
│   ├── layout.tsx                 # 루트 레이아웃
│   └── page.tsx                   # 홈 페이지
│
├── lib/                           # 유틸리티 및 API 클라이언트
│   ├── api.ts                     # 데이터 페칭 함수
│   └── utils.ts                   # 헬퍼 함수
│
├── types/                         # TypeScript 타입 정의
│
├── public/                        # 정적 자산
│   ├── data/                      # JSON 데이터 파일
│   ├── manifest.json              # PWA 매니페스트
│   └── sw.js                      # Service Worker
│
├── scripts/                       # 유틸리티 스크립트
│   └── send-daily-notification.ts # 일일 알림
│
├── DEVELOPMENT.md                 # 개발 가이드
└── package.json                   # 의존성
```

## 주요 기능

### 학사 섹션

- 카테고리별 공지사항 (학사, 장학금, 행사)
- 필터링 기능이 있는 학사 일정
- 졸업 요건 추적 도구
- 수강신청 인터페이스
- 학점 조회 (GPA, 이수학점)

### 캠퍼스 섹션

- 영양 정보 포함 주간 학식 메뉴
- 셔틀버스 실시간 위치 추적
- 도서관 열람실 이용 가능 여부
- 체육시설 정보
- 보건소 서비스

### 금융 섹션

- 교내외 장학금 정보
- 지원 마감일
- 장학금 세부 정보

### 검색

- 실시간 통합 검색
- 모든 카테고리 검색
- 반응형 검색 결과

## 기여하기

기여를 환영합니다! 다음 단계를 따라주세요:

1. 저장소를 **Fork** 하세요
2. 기능용 **브랜치** 생성하기 (`git checkout -b feature/amazing-feature`)
3. 변경사항 **Commit** 하기 (`git commit -m 'Add amazing feature'`)
4. 브랜치로 **Push** 하기 (`git push origin feature/amazing-feature`)
5. **Pull Request** 열기

상세한 개발 가이드에 대해서는 [DEVELOPMENT.md](./DEVELOPMENT.md)를 참고하세요.

### 코드 표준

- **TypeScript**: 전체 타입 커버리지 필수
- **컴포넌트**: React 훅을 사용한 함수형 컴포넌트
- **스타일링**: Tailwind CSS 유틸리티 사용
- **네이밍**: 함수/변수는 camelCase, 컴포넌트는 PascalCase
- **커밋**: 명확하고 설명적인 메시지 사용

## 라이선스

MIT 라이선스 - 자세한 내용은 [LICENSE](./LICENSE)를 참고하세요.

## 지원

버그를 발견했거나 기능 제안이 있으신가요? [이슈](https://github.com/singhic/syu-campus/issues)를 열어주세요.

## 감사의 말

- [Next.js](https://nextjs.org/) - React 프레임워크
- [Tailwind CSS](https://tailwindcss.com/) - 스타일링 프레임워크
- [Firebase](https://firebase.google.com/) - 백엔드 서비스
- [기상청](https://www.kma.go.kr/) - 날씨 데이터
- [Kakao Maps](https://apis.map.kakao.com/) - 지도 서비스

---

**삼육대학교 커뮤니티를 위해 만들었습니다**
