# 개발 가이드

SYU CAMPUS 개발, 운영, 배포에 필요한 핵심 정보를 정리한 문서입니다.

## 빠른 시작

### 요구사항

- Node.js 18.17 이상
- npm
- Python 3.11 이상: 크롤러 실행 시 필요

### 설치

```bash
git clone https://github.com/syu-kr/campus.syu.kr.git
cd campus.syu.kr
npm ci
cp .env.example .env.local
npm run dev
```

### 주요 명령어

```bash
npm run dev                       # 개발 서버
npm run lint                      # ESLint
npm run type-check                # TypeScript 검사
npm run build                     # 프로덕션 빌드
npm run build:analyze             # 번들 분석
npm run send-daily-notification   # 일일 공지 알림
npm run cleanup-tokens            # 오래된 FCM 토큰 정리
npm run cleanup-meet-rooms        # 만료된 일정 잡기 방 정리
```

## 프로젝트 구조

```text
campus.syu.kr/
├── app/
│   ├── api/                    # Next.js API routes
│   ├── components/             # shared UI components
│   ├── features/               # feature-scoped components and helpers
│   ├── academic/               # 학사
│   ├── campus/                 # 캠퍼스 생활
│   ├── more/                   # 더보기
│   ├── service/notices/        # 서비스 공지 화면
│   ├── layout.tsx
│   ├── page.tsx
│   ├── providers.tsx
│   └── globals.css
├── lib/
│   ├── api.ts                  # public JSON/API fetch helpers
│   ├── fetch-json.ts           # shared JSON fetch utility
│   ├── firebase.ts             # client Firebase Messaging
│   ├── firebaseAdmin.ts        # server Firebase Admin
│   ├── public-transit.ts       # public bus arrival adapter
│   ├── serviceNotices.ts       # service notice parser
│   └── weather.ts              # weather transform helpers
├── public/
│   ├── data/                   # static JSON datasets
│   ├── images/
│   ├── service-notices/        # service notice Markdown data
│   ├── manifest.json
│   └── sw.js
├── scripts/                    # crawlers and maintenance scripts
├── types/                      # shared TypeScript types
├── docs/                       # operational reference docs
└── .github/workflows/          # CI and scheduled data jobs
```

## 아키텍처

- Next.js App Router가 페이지와 API Route를 담당합니다.
- 화면 데이터는 `lib/api.ts`, feature helper, API Route를 통해 가져옵니다.
- 정적 데이터는 `public/data/*.json`을 우선 사용합니다.
- 외부 API 키가 필요한 요청은 API Route에서 프록시/정규화합니다.
- Firebase Admin은 서버 전용 코드에서만 사용합니다.
- FCM 클라이언트 초기화와 포그라운드 알림은 브라우저에서만 실행합니다.

```text
Client UI
  -> TanStack Query
  -> lib/api.ts or app/api/*
  -> public/data, Firebase Admin, external APIs
```

## 환경 변수

`.env.example`을 기준으로 `.env.local`을 구성합니다. `NEXT_PUBLIC_*` 값은 브라우저에 노출됩니다. 서비스 계정, 푸시 API 키, 관리자 키는 서버 환경 변수로만 설정하세요.

### Local/Vercel Runtime Variables

Vercel Project Settings와 로컬 `.env.local`에 필요한 값입니다.

| 이름 | 필수 | 사용처 | 설명 |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 필수 | campus map | Kakao Maps JavaScript SDK 키 |
| `NEXT_PUBLIC_PUBLIC_DATA_SERVICE_KEY` | 필수 | weather, public transit | 공공데이터포털 서비스 키 |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | 필수 | Firebase client | Firebase Web App API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | 필수 | Firebase client | Firebase Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | 필수 | Firebase client/admin scripts | Firebase project id |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | 필수 | Firebase client | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | 필수 | Firebase client/FCM | Firebase messaging sender id |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | 필수 | Firebase client | Firebase app id |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | 필수 | FCM web push | Web Push VAPID public key |
| `FIREBASE_SERVICE_ACCOUNT` | 필수 | Firebase Admin, notifications, admin APIs | Firebase service account JSON 문자열 |
| `PUSH_API_KEY` | 필수 | `/api/notifications/send`, daily notification | 내부 푸시 발송 API 인증 키 |
| `ADMIN_EMAILS` | 권장 | `/api/admin/submissions` | 관리자 허용 이메일 목록, 쉼표로 구분 |
| `API_URL` | Actions 필수, 로컬 선택 | daily notification script | 알림 발송 대상 앱 URL |
| `TOKEN_CLEANUP_DAYS` | 선택 | cleanup tokens script | 오래된 FCM 토큰 삭제 기준 일수, 기본값 `90` |
| `ANALYZE` | 선택 | bundle analyzer | `true`일 때 bundle analyzer 활성화 |
| `NEXT_PUBLIC_APP_URL` | 선택 | reserved/config | 앱 공개 URL. 현재 핵심 런타임 코드에서는 직접 사용하지 않음 |

`FIREBASE_ADMIN_SDK_KEY`는 `.env.example`에 남아 있는 legacy/대체 형식 값이며, 현재 코드에서는 `FIREBASE_SERVICE_ACCOUNT`를 사용합니다.

### GitHub Actions Secrets

Organization 레포 `syu-kr/campus.syu.kr`의 `Settings -> Secrets and variables -> Actions`에 등록할 값입니다. `GITHUB_TOKEN`은 GitHub가 자동 제공하므로 직접 만들지 않습니다.

| 이름 | 필수 | 사용 워크플로 | 설명 |
| --- | --- | --- | --- |
| `VERCEL_PERSONAL_ACCOUNT_TOKEN` | 필수 | `sync-to-vercel-repo.yml` | 개인 배포 레포 `singhic/syu-campus`에 push 가능한 GitHub fine-grained token. 권한은 해당 repo `Contents: Read and write` |
| `OFFICIAL_ACCOUNT_EMAIL` | 필수 | `sync-to-vercel-repo.yml` | 동기화 커밋 작성자 이메일 |
| `API_URL` | 필수 | `daily-announcement-notification.yml` | 알림 발송 API 호출 대상 URL. 운영 도메인 또는 Vercel production URL |
| `FIREBASE_SERVICE_ACCOUNT` | 필수 | `daily-announcement-notification.yml` | Firebase Admin service account JSON 문자열 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | 필수 | `daily-announcement-notification.yml` | Firebase Admin 초기화용 project id |
| `PUSH_API_KEY` | 필수 | `daily-announcement-notification.yml` | `/api/notifications/send` 호출 인증 키 |

Vercel 런타임 환경 변수는 GitHub Actions Secrets와 별개로 Vercel Project Settings에서 관리합니다.

## 데이터와 API

### 정적 JSON

`public/data/`의 JSON은 화면에서 직접 조회하거나 `lib/api.ts`를 통해 조회합니다. `fetchJson`을 사용할 때 `cache: "no-store"`와 `next.revalidate`를 동시에 지정하지 마세요.

### 크롤러

GitHub Actions에서 공지, 장학금, 행사, 캠퍼스 공지, 학식, 학사 일정, 전화번호 데이터를 갱신합니다.

```bash
pip install -r requirements.txt
python scripts/crawl_announcements.py
python scripts/crawl_scholarships.py
python scripts/crawl_events.py
python scripts/crawl_campus.py
python scripts/crawl_cafeteria.py
python scripts/crawl_schedule.py
python scripts/crawl_phone.py
```

### 외부 API

- 날씨: 기상청 단기예보/초단기예보 API
- 대중교통: 서울/경기도 공공데이터 버스 API
- 셔틀 위치: `/bus/shuttle` rewrites를 통해 `http://nexmotion.co.kr/bus/busStatusList.php` 호출
- 지도: Kakao Maps JavaScript SDK

버스 API 상세는 [docs/BUS_API_GUIDE.md](./docs/BUS_API_GUIDE.md)를 참고하세요.

### Firestore

클라이언트에서 Firestore를 직접 읽거나 쓰지 않습니다. API Route와 Firebase Admin SDK를 통해 접근하며, 보안 규칙은 [docs/FIRESTORE_RULES.md](./docs/FIRESTORE_RULES.md)를 기준으로 유지합니다.

사용 컬렉션:

- `meet_rooms`
- `meet_rooms/{roomId}/participants`
- `campus_tip_suggestions`
- `site_inquiries`
- `user_devices`
- `notifications_sent`

## 배포

개발 원본은 Organization 레포 `syu-kr/campus.syu.kr`입니다. Vercel 연결을 유지하기 위해 배포는 개인 레포 `singhic/syu-campus`를 통해 진행합니다.

배포 흐름:

```text
syu-kr/campus.syu.kr main push
  -> CI: lint, type-check, build
  -> Sync to Vercel Repository
  -> singhic/syu-campus main 동기화
  -> Vercel 배포
```

PR에서는 CI만 실행되며 개인 레포 동기화와 Vercel 배포는 실행하지 않습니다.
daily/monthly crawler가 `public/data/` 변경 커밋을 만들면, 해당 워크플로 안에서 검증과 동기화 워크플로를 호출해 개인 레포와 Vercel 배포까지 이어집니다. 데이터 변경이 없으면 동기화도 건너뜁니다.

배포 전 확인:

```bash
npm run lint
npm run type-check
npm run build
```

GitHub Actions는 다음 용도로 사용합니다.

- CI: lint, type-check, build
- sync-to-vercel-repo: CI 성공 후 개인 Vercel 연결 레포 동기화
- daily crawl: 공지, 장학금, 행사, 캠퍼스 공지, 학식 갱신 후 변경 시 동기화
- monthly crawl: 학사 일정, 전화번호 갱신 후 변경 시 동기화
- daily notification: 일일 공지 푸시 발송

## 개발 규칙

- TypeScript strict 모드를 기준으로 작성합니다.
- 라우트별 UI는 해당 route 또는 `app/features/`에 둡니다.
- 여러 화면에서 재사용하는 UI는 `app/components/`에 둡니다.
- 공유 로직은 `lib/`, 공유 타입은 `types/`에 둡니다.
- 운영 데이터에 더미/mock 데이터를 넣지 않습니다.
- 외부 API 실패 시 화면이 빈 상태나 안내 상태로 안전하게 내려가야 합니다.
- 변경 후 `npm run lint`, `npm run type-check`, 필요 시 `npm run build`를 실행합니다.

## 문제 해결

### Firebase 초기화 오류

- `.env.local`의 Firebase 환경 변수를 확인합니다.
- 서버 전용 키가 클라이언트 번들에 들어가지 않도록 확인합니다.
- 환경 변수 변경 후 개발 서버를 재시작합니다.

### 날씨/버스 API 오류

- 공공데이터포털 서비스 키와 API 활용 신청 상태를 확인합니다.
- 서울 버스 API는 XML 응답을 사용합니다.
- 일부 공공 API는 인코딩된 서비스 키가 필요합니다.

### Service Worker 문제

- `public/sw.js`가 배포되었는지 확인합니다.
- localhost 또는 HTTPS 환경에서 테스트합니다.
- 브라우저 Application 탭에서 기존 service worker/cache를 정리한 뒤 재시도합니다.

## 최종 업데이트

2026-05-05
