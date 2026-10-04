# 룸메이트 게시판 프로덕션 배포 및 공개 절차

2026-10-04 기준 배포 런북과 운영 준비 기록이다. PR 생성과 프로덕션 공개는 별도 단계다. 제품 계약은 [최종 계획](./ROOMMATE_BOARD_PLAN.md), 자동·격리 환경 시험의 증거는 [구현 및 검증 기록](./ROOMMATE_BOARD_IMPLEMENTATION.md)을 기준으로 한다. 실제 배포 성공은 해당 소스 SHA의 Production 배포와 운영 HTTPS 응답을 확인한 뒤 판단한다.

사용자는 이후 **프로덕션에 먼저 배포하고 실제 환경에서 시험한 뒤 오류를 제보**하는 방향으로 변경했다. 운영 필수 설정을 준비하고 보호 브랜치 CI와 배포 경로를 확인한 뒤 기능과 공지를 함께 반영한다. 사용자가 Blaze로 직접 전환했고 2026-10-04 실제 운영 Firebase Console에서 Blaze를 확인했다. 미완료 실제 기기·추가 메일·운영 시험은 통과로 처리하지 않고 [배포 후 시험 목록](./ROOMMATE_BOARD_PRODUCTION_TESTS.md)으로 이관한다. 이 결정은 기존 공개 보류와 선행 실제 기기 시험 조건을 변경한다.

## 현재 확인한 상태

| 항목 | 확인 결과와 공개 전 할 일 |
| --- | --- |
| 앱 구현 | `/campus/roommates` 및 영문 경로, 메일 인증, 글·신고·admin·정리 구현. 세 플래그의 미설정 기본값은 모두 `false` |
| 자동 검사 | 추가 경합·메일 중지·링크 오류 복구 검사 후 단위 테스트 394개와 전체 검사·production 빌드, 별도 Auth·Firestore 에뮬레이터 통합 13개 통과. PR 최종 커밋의 CI 결과는 다시 확인해야 함 |
| 브라우저 흐름 | 가상 학생의 실제 로컬 DB 등록·신고·모집 완료·여러 탭 로그아웃 확인 |
| 실제 학교 메일 | 실제 Firebase Auth로 발송·수신·Chrome 로그인·같은 브라우저 재방문·로그아웃 후 차단 확인. 이 시험의 게시판 세션과 요청 제한 자료는 로컬 Firestore에 격리했음 |
| Firebase 인증 제공자 | `syu-campus`의 이메일 제공자 `enabled=true`, `passwordRequired=false` 유지 확인 |
| Firebase 허용 도메인 | 기존 도메인 목록을 보존해 `campus.syu.kr`을 추가하고 API 재조회에서 반영 확인. 실제 운영 메일 완료 동작은 배포 후 시험 |
| 복합 인덱스 | 운영 콘솔에서 필수 네 개만 생성. 준비 기록 시점 API 상태는 모두 CREATING이며 배포 직전 READY 재확인 필요. 이전 READY 오판은 다른 컬렉션을 대조한 것으로 정정 |
| 운영 Rules | 기존 전체 클라이언트 접근 차단을 보존해 repo Rules 반영. Ruleset `e9bef7b6-530a-4bfe-916d-078542fc0823`, 운영·repo SHA-256 `e4e795b9ad00b9eb69282b9ea8a5245ce35ab632cba2aa2e8bce90f495725abf` 일치. 실제 학교 인증 클라이언트 직접 접근 시험은 배포 후 확인 |
| 요금제와 발송 한도 | 사용자가 직접 전환한 뒤 실제 Firebase Console에서 Blaze 확인. 공식 기본 로그인 링크 발송 기준 25,000통/일이며 추가 남용 제한이 적용될 수 있음. 이전 Spark 5통/일 제약은 현재 요금제 기준으로 적용하지 않음 |
| Preview Firebase | 별도 테스트 프로젝트가 아직 없음. 운영 service account·DB·HMAC 키를 Preview에 재사용하지 않음 |
| Vercel 등록 상태 | `ROOMMATES_OWNER_KEY_SECRET`은 독립 무작위 32-byte 비밀값을 Production 전용 Secret으로 등록. 세 룸메이트 플래그는 Production 전용 Config로 `true`를 등록. 기존 Firebase service account는 Production/Preview에 등록되어 있으므로 새 격리 Preview를 준비할 때 운영 계정을 재사용하지 않음 |
| 실제 기기 | 모바일 일반 브라우저, 카카오 인앱, 설치 웹앱의 인증·재방문은 미완료. PC 시험이나 viewport 변경으로 대신 판정하지 않음 |
| 실제 메일 추가 시험 | 재발송, 수신 지연·스팸 분류, 만료·재사용, 다른 수신 기기 시험은 미완료 |

위 표는 2026-10-04의 기록이다. 공개 직전에는 도메인·인덱스·Rules·요금제·배포 SHA를 다시 읽어 확인한다. 테스트용 학교 주소, 인증 링크, ID token, 쿠키, HMAC 비밀값과 서비스 계정 원문은 PR·문서·스크린샷에 남기지 않는다.

## 환경별 등록

실제 값은 각 서비스의 비밀값 저장소에만 등록한다. 이름과 등록 위치는 [환경 등록 안내](./ENVIRONMENT_REGISTRATION.md)를 따른다.

| 항목 | Vercel Production | Vercel Preview / Development | GitHub Actions |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_*` | 운영 웹 앱 설정. public project ID와 서비스 계정 `project_id`가 `syu-campus`로 일치하는지 확인 | 독립 테스트 Firebase 웹 앱 설정. 각 브라우저에 포함되는 공개 값이므로 빌드 시 대상 확인 | 기존 운영 정리 workflow는 `NEXT_PUBLIC_FIREBASE_PROJECT_ID` Secret 사용. CI는 자체 placeholder 설정 사용 |
| `FIREBASE_SERVICE_ACCOUNT` | Production 전용 운영 계정. 필요한 Auth 조회와 Firestore 서버 처리가 가능한지 확인 | 독립 테스트 프로젝트의 제한된 계정. 운영 계정을 복사하지 않음 | 기존 운영 정리용 Secret 유지. 정리에는 Firestore 읽기·쓰기·삭제 및 감사 기록 쓰기 권한 필요 |
| `ROOMMATES_OWNER_KEY_SECRET` | 독립 무작위 32-byte 이상 비밀값. 동일 환경의 모든 배포에서 안정적으로 유지 | 환경마다 별도 값. 운영 키 재사용 금지 | 룸메이트 정리는 저장된 owner ID를 사용하므로 등록 불필요 |
| `RATE_LIMIT_SECRET` | 기존 독립 무작위 비밀값 유지. 운영에서 없으면 공용 요청 제한 API 실패 | 환경마다 별도 값 | 정리 workflow에는 등록 불필요 |
| `ROOMMATES_ENABLED` | 최초 코드 배포에서는 명시적으로 `false` | 격리 환경 시험 때만 필요한 범위에서 `true` | 정리는 플래그를 읽지 않으므로 등록 불필요 |
| `ROOMMATES_WRITES_ENABLED` | 최초 코드 배포에서는 명시적으로 `false` | 글 작성 시험 시에만 `true` | 등록 불필요 |
| `ROOMMATES_EMAIL_ENABLED` | 최초 코드 배포에서는 명시적으로 `false` | 해당 테스트 Firebase의 도메인·제공자·한도 확인 후 `true` | 등록 불필요 |
| `ADMIN_EMAILS` | 실제 운영 담당자만 허용 | 테스트 담당자만 허용 | 정리 workflow에는 등록 불필요 |
| 에뮬레이터 설정 | `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`가 없어야 함 | 실제 Preview Firebase 시험에서도 에뮬레이터 호스트 없음 | 운영 정리 workflow에도 에뮬레이터 호스트 없음 |

Vercel 환경 변경은 해당 환경의 새 배포에 반영한다. 플래그는 admin에서 즉시 변경하는 설정이 아니다. 공개 전 Production과 Preview의 환경 선택 범위, Firebase public 값과 Admin 프로젝트의 일치 여부, 배포마다 owner 키가 바뀌지 않는지 확인한다. 현재 `initializeFirebaseAdmin()`은 service account의 프로젝트를 사용하고 인증 검증은 public project ID도 검사하므로 불일치를 두고 진행하지 않는다.

## 1. PR 검토와 필요한 경우의 비활성 코드 배포

현재 PR은 운영 필수 설정과 필수 CI를 확인한 후 기능 활성화와 공지를 함께 배포하는 경로를 사용한다. 아래 비활성 배포 절차는 사전 코드 반영이 별도로 필요하고 공지를 준비 안내로 맞춘 경우에만 수행한다.

1. PR 최종 커밋 SHA, 변경 범위, 검사 결과를 기록한다. 단위 검사·전체 검사와 에뮬레이터 통합 검사는 별도 결과로 표시한다. 현재 CI의 `npm run check`는 에뮬레이터 통합 스크립트를 자동 실행하지 않는다.
   로컬 production 화면 시험은 `next start --hostname localhost --port 3020`으로 실행한다. `127.0.0.1` 바인딩은 NextURL의 localhost 정규화와 내부 rewrite의 origin 판정이 어긋나 영문 쿠키에서 자체 리다이렉트를 만들 수 있으며, 같은 빌드의 localhost 바인딩 재검증에서는 `/en` 화면 200 및 언어 쿠키의 단일 리다이렉트가 정상임을 확인했다.
2. Production에 세 플래그가 미설정이거나 `false`인지 확인한다. 이미 다른 배포에 `true`가 저장되어 있다면 코드 기본값에만 기대지 않고 배포 전에 `false`로 맞춘다.
3. 병합 승인 후 보호 브랜치의 실제 필수 검사를 만족한 SHA를 main에 병합한다. 오늘 API에서 확인한 필수 검사는 `Audit and Check`, `Android TWA`, `Analyze JavaScript and TypeScript`, `Dependency Review`이며 브랜치 최신 상태 요구(`strict=true`)가 적용된다. PR의 성공을 main의 성공으로 대신 기록하지 않는다.
4. main CI 성공 후 `Sync to Vercel Repository` 완료와 해당 소스 SHA의 Vercel Production 배포를 확인한다. 현재 동기화 workflow는 성공한 main CI의 push / workflow_dispatch에서 자동 실행되며, PR 검사 성공만으로 배포되지 않는다. 수동 우회 배포나 검증 생략을 사용하지 않는다.
5. 운영 HTTPS에서 캠퍼스에 룸메이트 메뉴가 노출되지 않고, 직접 게시판 진입은 준비 안내이며, `/api/roommates/posts`가 `503 FEATURE_DISABLED`인지 확인한다. 미인증 admin API는 401이어야 한다.
6. 한국어·영문 보호 페이지와 API의 `private, no-store`, `noindex, nofollow`, `no-referrer`를 확인한다. 페이지 소스에 사용자 글·연락처가 없어야 한다. 배포한 SHA, URL, 플래그 상태, HTTP 결과를 기록한다.

이 단계는 비활성 코드 반영이다. 사용자의 후속 요청으로 `public/service-notices/017-roommate-board.md` 원고는 공개 완료 안내로 수정했다. 현재 공지 시스템에는 초안 상태가 없으므로 이 원고를 포함한 PR을 비활성 기능 상태로 배포하면 공개 완료 문구와 실제 기능이 어긋난다. 공개 조건을 갖추고 기능 활성화와 공지 배포를 같은 출시 단계에서 진행하거나, 별도 비활성 코드 배포가 필요하면 공지를 준비 안내로 유지한 뒤 활성화 배포에서 공개 원고를 반영한다.

## 2. Firebase 및 운영 사전 준비

### 이메일 링크와 도메인

1. 운영 Firebase의 Email/Password 제공자와 Email link 활성화를 재조회한다. 현재 이메일 링크는 켜져 있으므로 불필요하게 다른 로그인 설정을 덮어쓰지 않는다.
2. Firebase Authentication의 Authorized domains에 `campus.syu.kr`을 등록하고 실제 목록에 반영됐는지 재조회한다. 프로토콜이나 `/campus/roommates/verify/finish` 경로 대신 도메인만 등록한다. 기존 Firebase 도메인을 임의로 삭제하지 않는다.
3. 운영 완료 URL은 `https://campus.syu.kr/campus/roommates/verify/finish`, 영문은 `https://campus.syu.kr/en/campus/roommates/verify/finish`다. 앱은 이 운영 origin과 해당 배포의 `VERCEL_URL` origin만 허용한다. Preview를 시험하려면 그 배포의 실제 호스트를 테스트 Firebase 허용 도메인에도 등록한다. 임의 Preview alias가 자동 허용된다고 가정하지 않는다.
4. 기본 인증 템플릿의 앱 이름·언어·완료 흐름을 확인한다. 별도 SMTP나 숫자 코드 발송기 설정은 이 구현에 필요하지 않다. 다른 브라우저에서는 수신 이메일 재입력이 정상 흐름이다. [Firebase 이메일 링크 인증](https://firebase.google.com/docs/auth/web/email-link-auth)
5. 콘솔에서 실제 요금제, 결제 연결, 인증 제공자 한도와 최근 사용량을 확인한다. 2026-10-04 공식 문서의 로그인 링크 기본 발송 한도는 Spark 5통/일, Blaze 25,000통/일이며 추가 남용 제한이 적용될 수 있다. 이메일 주소 확인 메일이나 링크 생성 한도를 발송 한도로 대신 적용하지 않는다. 충분한 한도를 확보하기 전 공개하지 않는다. [Firebase Authentication 한도](https://firebase.google.com/docs/auth/limits)

앱의 admin 메일 카운터는 사이트를 통해 요청한 횟수다. Firebase 전체 발송량이나 잔여 quota가 아니다. 결제·요금제 변경이 필요하면 비용과 변경 범위를 확정한 뒤 별도로 진행한다.

### Rules와 인덱스

`firestore.rules`의 네 컬렉션 `roommate_sessions`, `roommate_posts`, `roommate_owner_state`, `roommate_reports`는 모든 클라이언트의 직접 읽기·쓰기를 거부한다. 학생 인증은 앱 서버 접근 조건이며 Firestore SDK 권한이 아니다. Admin SDK의 서버 권한은 Rules와 별도로 service account로 관리한다.

| 컬렉션 그룹 / query scope | 필드와 순서 | 쓰는 기능 | 현재 상태 |
| --- | --- | --- | --- |
| `roommate_posts` / COLLECTION | `status` ASC, `created_at` DESC | 학생 최신 목록과 admin 상태 필터 | 생성 후 API 조회 CREATING. 배포 전 READY 확인 |
| `roommate_posts` / COLLECTION | `status` ASC, `recruit_until` ASC | admin 현재 모집글 수 | 생성 후 API 조회 CREATING. 배포 전 READY 확인 |
| `roommate_reports` / COLLECTION | `status` ASC, `expires_at` ASC | admin 신고 목록과 미처리 수 | 생성 후 API 조회 CREATING. 배포 전 READY 확인 |
| `api_rate_limits` / COLLECTION | `metric` ASC, `window_start` ASC | admin 사이트 메일 요청량 | 생성 후 API 조회 CREATING. 배포 전 READY 확인 |

승인된 환경에 저장소 Rules와 인덱스를 반영할 때 대상 프로젝트를 명시한다.

```powershell
firebase deploy --project syu-campus --only firestore:rules,firestore:indexes
```

명령 실행 성공만으로 인덱스 준비를 판정하지 않는다. 전체 repo 인덱스와 운영 현황의 차이를 먼저 검토하고, 기존 인덱스 삭제 제안이 있다면 필요한 기존 정의를 보존한다. 준비가 끝나 모든 필요한 COLLECTION 인덱스가 READY가 된 뒤 admin의 실제 쿼리 성공도 확인한다. 에뮬레이터 성공은 운영 복합 인덱스를 검증하지 않는다. [Firestore 인덱스 관리](https://firebase.google.com/docs/firestore/query-data/indexing)

`firebase deploy --only firestore`는 사용하지 않는다. TTL은 다음 절에서 별도 관리한다. 운영에 반영된 Rules 버전과 배포 시각을 기록하고, 실제 학교 인증 클라이언트도 네 컬렉션에 직접 읽기·쓰기를 할 수 없는지 확인한다. 비공개 자료를 덤프하지 않고 별도 시험 대상·존재하지 않는 경로 등을 사용한다.

### 만료 정리와 관리자 운영

- 기존 `.github/workflows/cleanup-expired-firestore.yml`은 매일 18:30 UTC, 한국 시간 다음 날 03:30에 `npm run cleanup-expired-firestore`를 실행한다. `scripts/cleanup_meet_rooms.ts`가 새 `cleanupRoommateDocuments()`를 호출하므로 별도 정리 workflow가 필요하지 않다. GitHub 예약 실행이 정확한 시각을 보장한다고 안내하지 않는다.
- Actions의 `FIREBASE_SERVICE_ACCOUNT`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`가 같은 운영 프로젝트를 대상으로 하는지 확인한다. 새 owner 비밀값이나 룸메이트 플래그를 Actions에 추가할 필요는 없다. 최근 정리 작업 성공·실패 기록과 실행 담당자의 수동 대응 권한을 확인한다.
- `roommate_sessions`와 `roommate_posts`의 관리형 TTL은 `expires_at`을 기준으로 선택적으로 사용할 수 있다. `roommate_reports`와 `roommate_owner_state`에는 TTL을 설정하지 않는다. 신고 정리는 미처리 보존 종료 감사 기록을 남겨야 하고 owner 정리는 유효한 보류와 활성 글을 트랜잭션에서 다시 확인해야 한다. TTL을 사용해도 정리 workflow를 유지한다.
- 정리 스크립트는 dry-run 기능이 없고 기존 meet·시간표·알림 자료까지 실제 삭제한다. 프로덕션의 수동 실행을 기능 시험으로 사용하지 않는다. 합성 문서의 만료와 경합 시험은 격리된 환경에서 실행하고, 운영에서는 정상 예약 실행의 요약 카운터·오류만 확인한다.
- `/admin`의 룸메이트 게시글·신고 화면을 운영 담당자가 접근할 수 있는지 확인한다. 담당자와 확인 주기, 신고 처리 메모, 사고 시 숨김·삭제·작성 보류 수행자를 공개 전에 정한다. 이 구현은 자동 신고 판정이나 별도 신고 수신 알림을 보장하지 않는다.
- 전체 기능을 꺼도 admin은 조치할 수 있다. `/api/admin/roommate-posts`, `/api/admin/roommate-reports`는 기존 admin Bearer token 검증을 유지하며 학생 쿠키만으로 허용되지 않는다.

정리/TTL의 전체 계약은 [Firestore 운영 문서](./FIRESTORE_RULES.md)를 따른다. 보존 종료 정리의 실패를 공개 조회 허용으로 처리하지 않으며, 서버는 물리 삭제 전에도 만료된 글·세션을 거부한다.

## 3. 격리된 환경의 공개 전 시험

별도 Preview Firebase와 독립 비밀값을 준비한 후 해당 환경에서 세 플래그를 켜고 아래 순서를 수행한다. 운영에서 이 절차를 재현하려면 실제 인증·세션·글·신고·감사 자료가 남는 범위를 확정해 별도로 승인한다. 운영 credential을 에뮬레이터 하네스에 넣거나 운영 DB에 하네스의 초기화 명령을 실행하지 않는다.

| 시험 | 통과 기준 |
| --- | --- |
| 실제 PC 인증·재발송 | 학교 주소만 발송, 60초 재발송 제한, 전달 시간·스팸 위치 확인, 정상 링크 완료. 잘못된 주소·불일치 주소·재사용·만료 링크의 실제 안내 확인 |
| 실제 모바일 | Android/iOS 등 대상 일반 브라우저에서 메일 앱→브라우저 복귀와 인증 완료, 재방문·30일 선택 해제·로그아웃 확인 |
| 카카오 인앱·설치 웹앱 | 링크를 여는 브라우저와 재방문 저장소의 공유 여부 확인. 공유되지 않는 경우 수신 이메일 재입력 또는 일반 브라우저 사용 안내가 실제 동작과 일치 |
| 글·연락·신고 | A 등록→B 목록/상세/카카오 연결→B 신고→admin 처리→A 완료/삭제. 타인 수정 거부·중복 활성 글 거부·버전 충돌·보류 유지 확인 |
| 학생/admin 분리 | 같은 브라우저 학생 인증·로그아웃 전후 기존 admin 로그인이 유지. 학생에게 admin 자료나 권한이 생기지 않음 |
| 인증 폐기 | 시험 Auth 사용자 비활성·이메일 변경·token 폐기 후 기존 세션 차단. 인프라 장애는 503이고 정상 로그아웃으로 오인하지 않음 |
| 캐시와 관측 | 로그아웃→뒤로가기·다른 탭에 연락처 없음. Service Worker 오프라인 캐시에 글 없음. 완료 화면 query가 제거되고 GA·Sentry·배포 요청 로그에 이메일·OOB code·token 원문이 수집되지 않도록 실제 설정 확인 |
| 중지와 복구 | 아래 스위치의 실제 환경 변경→재배포→기능 차이 확인. 단위 검사 결과만으로 Vercel 설정 반영을 판정하지 않음 |

메일/쿠키 검증은 URL·HTTP 상태·쿠키 속성·사용자의 수신 확인만 기록한다. 세션 token 원문과 링크 query를 보고서에 복사하지 않는다. 장기 30일 경과 시험은 실제 기간 경과와 시간 경계 자동 검사를 구분한다.

## 4. 별도 활성화와 공개 확인

앞 절의 공개 조건과 운영 담당자 준비가 끝난 뒤, 별도의 활성화 승인에서 대상 환경·배포 SHA·플래그 세 개·변경 시각을 확정한다. 공개 환경에는 운영자만 이용하게 하는 별도 allowlist가 없으므로 `ROOMMATES_ENABLED=true`를 내부 전용 시험 모드로 표현하지 않는다.

1. 공개할 Production의 `ROOMMATES_ENABLED=true`, `ROOMMATES_WRITES_ENABLED=true`, `ROOMMATES_EMAIL_ENABLED=true`를 적용해 새 배포한다. 짧은 읽기 전용 점검이 필요하면 `true / false / true`로 인증·조회부터 확인하고, 글 쓰기는 별도 배포로 연다. 이 단계도 학교 메일 사용자에게 공개될 수 있다.
2. `https://campus.syu.kr`과 영문 경로에서 실제 운영 메일 완료 URL·쿠키·재방문·로그아웃을 확인한다. 승인한 최소 범위의 운영 시험 글과 신고를 등록한다면 시험 종료 처리와 보존 정책까지 기록한다.
3. 학생용 API 성공, admin 목록·건수·신고 쿼리 성공, 비인증/타인 권한 거부, 개인정보 링크 비공개를 확인한다. 미준비 인덱스 오류·503·메일 한도 오류를 빈 목록이나 성공으로 판정하지 않는다.
4. 공개 완료 문구로 준비된 `public/service-notices/017-roommate-board.md` 원고를 기능 활성화와 맞춰 반영하고, 실제로 열린 뒤 안내와 기능이 일치하는지 확인한다. 원고 수정 자체를 공개 완료로 판단하지 않는다. 공개 안내 링크는 `/campus/roommates`를 사용하고 가입 화면 없음·학교 메일 최초 인증·같은 브라우저 재방문·카카오 연락의 실제 범위만 안내한다.
5. 공개 후 초기 며칠은 담당자가 admin 신고·글·앱 메일 요청량, Firebase 실제 quota/오류, Vercel 401·429·503 및 정리 workflow 실패를 확인한다. 개인 이메일·글 본문·연락처·인증값을 관측 로그에 추가하지 않는다.

## 중지와 롤백

| 상황 | 설정 또는 조치 | 유지되는 기능 |
| --- | --- | --- |
| 전체 기능 사고·접근 차단 | `ROOMMATES_ENABLED=false`로 새 Production 배포 | 로그아웃과 admin 사고 대응. 학생 조회·새 세션 발급·사이트 메일 요청 차단 |
| 신규 글/수정 남용 | 전체는 `true`, `ROOMMATES_WRITES_ENABLED=false`로 배포 | 기존 글 조회, 본인 완료·삭제, 신고, 인증·로그아웃 |
| 메일 quota·전달 장애 | 전체는 `true`, `ROOMMATES_EMAIL_ENABLED=false`로 배포 | 기존 유효 세션, 이미 받은 유효 링크의 세션 완료, 로그아웃. 사이트 새 발송만 중지 |
| 개별 개인정보·괴롭힘 신고 | admin 즉시 숨김·삭제·작성 보류, 필요 시 전체 중지 병행 | 다른 글 운영 및 신고 처리 |
| 코드 회귀 | 우선 전체 중지 배포로 접근 차단 후 검증된 이전 Vercel 배포로 복구 | 복구한 코드의 기능만 제공. 정리 업무와 데이터 보존은 별도 확인 |

플래그는 재배포까지 시간이 걸리므로 admin의 개별 숨김·삭제를 병행할 수 있다. 메일 플래그는 앱 발송 경로만 제어하며 Firebase 공개 인증 API 직접 요청까지 차단하지 않는다. 직접 발송 남용은 제공자 설정·quota·보호 수단으로 별도 대응한다.

이전 배포로 복구할 때 세 플래그가 비활성 상태이고 새 비공개 Rules가 유지되는지 실제 응답으로 확인한다. 복구를 위해 인덱스·Rules·기존 글·세션·신고를 일괄 삭제하거나 Firebase 사용자 계정을 삭제하지 않는다. 이전 코드에는 새 룸메이트 정리가 없을 수 있으므로 소스 저장소의 승인된 정리 workflow를 유지한다. 자동 예약 실행은 default branch 코드를 사용하므로 코드 자체를 되돌린다면 정리 경로가 남는지 함께 검토한다.

`ROOMMATES_OWNER_KEY_SECRET` 교체는 롤백이나 일반 배포 조치로 사용하지 않는다. 키가 바뀌면 기존 세션과 현재 이메일의 연결이 달라지고 재인증해도 이전 글 owner와 일치하지 않으며 활성 글·보류 식별에 영향을 준다. 안정적인 기존 키를 유지하고, 유출 대응 등 필요한 경우에만 데이터 이전·세션 폐기·사용자 안내를 포함한 별도 절차를 세운다. `RATE_LIMIT_SECRET`도 임의 교체로 제한 카운터를 초기화하지 않는다.

복구는 원인 해결→해당 환경 검사→새 배포→HTTPS 실동작 확인 순서로 진행한다. 최종적으로 소스 SHA, Production 배포 ID, Firebase Rules 버전, 필요한 인덱스 READY, 세 플래그 상태, 시험 결과와 운영 담당자를 기록한 뒤 공개 상태로 판정한다.

## 공개 승인 체크리스트

- [ ] PR 최종 SHA의 필수 CI와 독립 에뮬레이터 검사 확인
- [ ] 공개 조건 충족 후 main→Sync→Vercel Production 반영 확인. 별도 비활성 사전 배포가 필요한 경우에는 공지를 준비 안내로 맞춘 배포만 사용
- [ ] Production/Preview/Actions Firebase 프로젝트·계정·HMAC 키 분리와 일치 확인
- [ ] 운영 `campus.syu.kr` 허용 도메인 등록 및 실제 메일 완료 URL 확인
- [ ] 실제 Firebase 요금제와 충분한 기본 발송 quota 확인
- [ ] 네 비공개 컬렉션의 배포 Rules 및 학교 인증 클라이언트 직접 접근 거부 확인
- [ ] 표의 네 복합 인덱스 READY와 admin 실제 쿼리 확인
- [ ] 실제 메일 재발송·오류/재사용·스팸 위치 확인, 실제 모바일·인앱·설치 웹앱 확인
- [ ] 운영 신고 담당자·확인 주기 및 정리 workflow 실행 성공 확인
- [ ] 환경 변경과 재배포에 의한 중지·복구 절차 확인
- [ ] 활성화 범위 별도 승인→Production 새 배포→실동작 확인
- [ ] 공개 완료 공지 원고가 기능 활성화 배포와 일치하고 실제 이용 가능한 상태인지 확인
