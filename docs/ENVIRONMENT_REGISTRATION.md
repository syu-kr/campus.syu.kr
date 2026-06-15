# Environment Registration Guide

이 문서는 외부 호출 URL과 민감 값을 코드에서 빼고 어디에 등록해야 하는지 정리합니다. 실제 URL 값은 이 문서에 적지 않습니다.

## Vercel Project Environment Variables

등록 위치:

`Vercel Dashboard -> syu-campus Project -> Settings -> Environment Variables`

환경별 등록 원칙:

- 운영 데이터에 접근하는 민감 값은 `Production`에만 등록합니다.
- `Preview`, `Development`에는 별도 Firebase 프로젝트, 제한된 service account, 별도 `PUSH_API_KEY`, 별도 `RATE_LIMIT_SECRET`을 사용합니다.
- 공개 값과 외부 공개 API endpoint도 가능하면 환경별로 분리합니다. 같은 값을 써야 하는 경우에만 여러 환경에 체크합니다.
- Vercel Preview에 운영 `FIREBASE_SERVICE_ACCOUNT`를 등록하지 않습니다.

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `PUBLIC_DATA_SERVICE_KEY` | 필수 | 공공데이터포털 서비스 키. 서버 전용이므로 `NEXT_PUBLIC_`를 붙이지 않습니다. |
| `KMA_NCST_URL` | 필수 | 기상청 초단기 실황 endpoint |
| `KMA_FCST_URL` | 필수 | 기상청 초단기 예보 endpoint |
| `SEOUL_BUS_ARRIVAL_URL` | 필수 | 서울 버스 도착 endpoint |
| `GYEONGGI_BUS_ARRIVAL_URL` | 필수 | 경기도 버스 도착 endpoint |
| `SHUTTLE_LOCATION_URL` | 필수 | 셔틀 실시간 위치 endpoint |
| `SHUTTLE_REFERER` | 필수 | 셔틀 upstream 요청 Referer |
| `SHUTTLE_USER_AGENT` | 필수 | 셔틀 upstream 요청 User-Agent |
| `LECTURE_TIMETABLE_URL` | 필수 | 강의 시간표 endpoint |
| `LIBRARY_READING_ROOMS_URL` | 필수 | 도서관 열람실 현황 endpoint |
| `FIREBASE_SERVICE_ACCOUNT` | 필수 | Firebase Admin service account JSON 문자열. 운영 값은 Production 전용 |
| `PUSH_API_KEY` | 필수 | 내부 푸시 발송 API 인증 키. 환경별로 별도 값 사용 |
| `RATE_LIMIT_SECRET` | 운영 필수 | 서버리스 인스턴스 간 API rate limit 키를 HMAC 처리하는 32-byte 이상의 무작위 비밀 값. Production에서는 미등록 시 public write API가 실패함 |
| `ADMIN_EMAILS` | 필수 | 쉼표로 구분한 관리자 허용 이메일 목록. 운영 관리자 목록은 Production 전용으로 관리 |
| `TOKEN_CLEANUP_DAYS` | 선택 | 오래된 FCM 토큰 삭제 기준 일수. 기본값 `90` |

### RATE_LIMIT_SECRET 생성 및 등록

PowerShell에서 아래 명령을 한 번 실행하고 출력된 문자열 전체를 Vercel의 `RATE_LIMIT_SECRET` 값으로 등록합니다.

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

- 출력 예시는 문서에 남기지 않습니다. 실제로 생성된 값을 사용합니다.
- `PUSH_API_KEY`, Firebase 키, 비밀번호를 재사용하지 않습니다.
- Production, Preview, Development마다 별도 값을 생성합니다.
- 같은 환경 내에서는 모든 서버리스 인스턴스가 같은 값을 사용해야 하므로 Vercel 환경 변수로 고정합니다.
- 값을 교체하면 기존 rate limit 문서와 다른 HMAC 문서 ID가 생성됩니다. 긴급 상황이 아니라면 자주 회전하지 않습니다.
- Production에서는 `RATE_LIMIT_SECRET`이 없으면 요청 제한 공용 저장소를 쓰는 API가 503으로 실패합니다.

## Vercel Public Variables

등록 위치:

`Vercel Dashboard -> syu-campus Project -> Settings -> Environment Variables`

이 값들은 브라우저에서 직접 사용하므로 숨길 수 없습니다.

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 필수 | Kakao Maps JavaScript SDK 키 |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | 필수 | Firebase Web App API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | 필수 | Firebase Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | 필수 | Firebase project id |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | 필수 | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | 필수 | Firebase messaging sender id |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | 필수 | Firebase app id |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | 필수 | Web Push VAPID public key |

## GitHub Actions Secrets

등록 위치:

`GitHub Repository -> Settings -> Secrets and variables -> Actions -> Secrets`

대상 레포:

`syu-kr/campus.syu.kr`

| 이름 | 필수 | 사용 워크플로 | 설명 |
| --- | --- | --- | --- |
| `API_URL` | 필수 | `daily-announcement-notification.yml` | 알림 발송 API 호출 대상 앱 URL. GitHub Actions에서는 운영 HTTPS URL만 사용하고 localhost를 쓰지 않음 |
| `PUSH_API_KEY` | 필수 | `daily-announcement-notification.yml` | `/api/notifications/send` 호출 인증 키 |
| `FIREBASE_SERVICE_ACCOUNT` | 필수 | `daily-announcement-notification.yml`, `cleanup-expired-firestore.yml` | Firebase Admin service account JSON 문자열 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | 필수 | `daily-announcement-notification.yml` | Firebase Admin 초기화용 project id |
| `CRAWLER_DEPLOY_KEY` | 필수 | `crawl-daily.yml`, `crawl-monthly.yml` | `main`에 자동 커밋하는 write deploy key의 private key |
| `VERCEL_PERSONAL_ACCOUNT_TOKEN` | 필수 | `sync-to-vercel-repo.yml` | 개인 배포 레포에 push 가능한 GitHub token |
| `OFFICIAL_ACCOUNT_EMAIL` | 필수 | `sync-to-vercel-repo.yml` | 동기화 커밋 작성자 이메일 |

### CRAWLER_DEPLOY_KEY 등록

`crawl-daily.yml`과 `crawl-monthly.yml`은 PAT 대신 repository deploy key로 `main`에 자동 커밋합니다.

1. 전용 SSH key pair를 생성합니다.
2. Public key를 `GitHub Repository -> Settings -> Deploy keys`에 등록하고 `Allow write access`를 켭니다.
3. Branch ruleset bypass 대상에서 `deploy keys`를 허용합니다.
4. Private key 전체를 `CRAWLER_DEPLOY_KEY` Actions secret으로 등록합니다.

## GitHub Actions Variables

등록 위치:

`GitHub Repository -> Settings -> Secrets and variables -> Actions -> Variables`

대상 레포:

`syu-kr/campus.syu.kr`

URL은 비밀번호는 아니지만 공개 코드에서 감추기 위해 Variables에 둡니다.

| 이름 | 필수 | 사용 워크플로 | 설명 |
| --- | --- | --- | --- |
| `CRAWL_ACADEMIC_NOTICES_URL` | 필수 | `crawl-daily.yml` | 학사공지 목록 page base URL |
| `CRAWL_SCHOLARSHIP_NOTICES_URL` | 필수 | `crawl-daily.yml` | 장학공지 목록 page base URL |
| `CRAWL_CAMPUS_NOTICES_URL` | 필수 | `crawl-daily.yml` | 캠퍼스 생활공지 목록 page base URL |
| `CRAWL_CAFETERIA_URL` | 필수 | `crawl-daily.yml` | 학식 메뉴 URL |
| `CRAWL_PHONE_DIRECTORY_URL` | 필수 | `crawl-monthly.yml` | 전화번호 안내 URL |
| `CRAWL_ACADEMIC_SCHEDULE_URL` | 필수 | `crawl-monthly.yml` | 학사일정 URL |
| `VERCEL_DESTINATION_REPO` | 필수 | `sync-to-vercel-repo.yml` | 동기화 대상 개인 배포 레포. `owner/name` 형식 |

## Firebase Console Configuration

Firestore Rules는 저장소 루트의 `firestore.rules`를 기준으로 배포합니다. Firebase 콘솔에서 직접 붙여넣어 publish해도 되고, Firebase CLI를 쓰는 경우에는 아래처럼 rules만 배포합니다.

현재 저장소는 Firestore indexes를 코드로 관리하지 않습니다. 운영 인덱스를 실수로 건드리지 않도록 `firebase deploy --only firestore` 대신 `firebase deploy --only firestore:rules`만 사용합니다.

```powershell
firebase deploy --only firestore:rules
```

새 컬렉션을 추가하면 먼저 rules 파일에서 client read/write가 차단되어 있는지 확인하고, 콘솔에 수동 반영한 내용도 repo 파일과 같은 상태로 유지합니다.

TTL 정책은 [FIRESTORE_RULES.md](./FIRESTORE_RULES.md)의 컬렉션 그룹 목록과 순서를 기준으로 등록합니다.

## Local Development

Next.js 로컬 서버는 `.env.local`을 읽습니다. Vercel Project Environment Variables 표의 값을 같은 이름으로 `.env.local`에 등록하세요. 로컬에서는 운영 Firebase service account 대신 개발용 프로젝트 또는 제한된 service account를 사용합니다.

Python 크롤러는 `.env.local`을 자동으로 읽지 않습니다. 로컬에서 크롤러를 직접 실행할 때는 PowerShell에서 필요한 값을 먼저 설정하세요.

```powershell
$env:CRAWL_ACADEMIC_NOTICES_URL="..."
python scripts/crawl_announcements.py
```

## Not Moved

아래 항목은 브라우저나 service worker가 직접 로드해야 하므로 URL 노출을 막을 수 없습니다.

| 항목 | 이유 |
| --- | --- |
| Kakao Maps SDK | 브라우저가 직접 script를 로드 |
| Google Analytics gtag script | 브라우저가 직접 script를 로드 |
| Firebase service worker CDN | service worker가 직접 `importScripts`로 로드 |
| Firebase Web App `NEXT_PUBLIC_*` config | 클라이언트 SDK 초기화에 필요 |
