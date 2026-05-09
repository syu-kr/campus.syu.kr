# SYU CAMPUS

삼육대학교 학생들을 위한 통합 정보 플랫폼입니다. 공지사항, 학식, 학사 일정, 셔틀, 도서관, 장학금, 연락처, 캠퍼스 생활 자료를 한 곳에서 확인할 수 있습니다.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwind-css)](https://tailwindcss.com/)

## 주요 기능

- 통합 검색: 공지사항, 학사 일정, 장학금, 연락처, 캠퍼스 생활 자료 검색
- 학사 정보: 학사 공지, 학사 일정, 졸업 요건, 시간표
- 캠퍼스 생활: 학식, 셔틀버스, 대중교통, 도서관, 지도, 체육관, 보건소
- 더보기: 장학금, 전화번호, 캠퍼스 꿀팁, 일정 잡기, 서비스 공지
- PWA 및 푸시 알림: 앱 설치, 서비스 워커, Firebase Cloud Messaging
- 반응형 UI: 모바일과 데스크톱 모두 지원

## 빠른 시작

### 요구사항

- Node.js 18.17 이상
- npm

### 설치 및 실행

```bash
git clone https://github.com/syu-kr/campus.syu.kr.git
cd campus.syu.kr
npm ci
cp .env.example .env.local
npm run dev
```

개발 서버는 [http://localhost:3000](http://localhost:3000)에서 실행됩니다.

### 검증

```bash
npm run lint
npm run type-check
npm run build
```

## 문서

- [DEVELOPMENT.md](./DEVELOPMENT.md): 개발 환경, 구조, API, 배포 가이드
- [PERFORMANCE.md](./PERFORMANCE.md): 번들 및 성능 점검 가이드
- [SEO_OPTIMIZATION_CHECKLIST.md](./SEO_OPTIMIZATION_CHECKLIST.md): SEO 점검 항목
- [docs/FIRESTORE_RULES.md](./docs/FIRESTORE_RULES.md): Firestore 보안 규칙
- [docs/BUS_API_GUIDE.md](./docs/BUS_API_GUIDE.md): 공공데이터 버스 API 참고

## 기술 스택

- Next.js 14 App Router
- React 18, TypeScript 5.3
- Tailwind CSS 3.4
- TanStack Query 5
- Firebase, Firebase Admin SDK, Firebase Cloud Messaging
- Kakao Maps API
- 기상청 및 공공데이터포털 API
- Vercel, GitHub Actions

## 프로젝트 구조

```text
campus.syu.kr/
├── app/                    # Next.js App Router routes, UI, API
│   ├── api/                # API routes
│   ├── components/         # shared UI components
│   ├── academic/           # academic pages
│   ├── campus/             # campus pages
│   ├── more/               # additional tools
│   └── service/notices/    # service notice pages
├── lib/                    # data fetching, Firebase, utilities
├── types/                  # shared TypeScript types
├── public/
│   ├── data/               # generated/curated JSON datasets
│   ├── images/             # static images
│   ├── service-notices/    # service notice Markdown files
│   ├── manifest.json
│   └── sw.js
├── scripts/                # crawlers and scheduled maintenance scripts
├── docs/                   # operational reference docs
└── .github/workflows/      # CI and scheduled crawlers
```

## 데이터 갱신

정적 데이터는 `public/data/`의 JSON 파일을 기준으로 제공됩니다. 공지사항, 장학금, 행사, 학식, 학사 일정, 연락처 등은 `scripts/`의 크롤러와 GitHub Actions로 갱신합니다.

```bash
pip install -r requirements.txt
python scripts/crawl_announcements.py
python scripts/crawl_scholarships.py
python scripts/crawl_campus.py
python scripts/crawl_events.py
python scripts/crawl_cafeteria.py
```

## 배포

개발과 협업은 Organization 레포 `syu-kr/campus.syu.kr`에서 진행합니다. `main` 브랜치의 CI가 성공하면 GitHub Actions가 Vercel에 연결된 개인 레포 `singhic/syu-campus`로 소스 파일을 동기화하고, Vercel은 그 개인 레포의 변경을 감지해 배포합니다.

## 라이선스

MIT License. 자세한 내용은 [LICENSE](./LICENSE)를 참고하세요.
