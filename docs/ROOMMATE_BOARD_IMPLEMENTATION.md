# 룸메이트 게시판 구현 및 검증 기록

2026-10-04. 제품 및 서버 계약은 [최종 계획](./ROOMMATE_BOARD_PLAN.md)을 기준으로 한다.

## 구현 상태

`main`에서 `git pull --ff-only origin main`으로 `362708a`까지 갱신한 뒤 `codex/campus-roommate-board` 브랜치를 생성했다. 이 브랜치에서 구현·검증을 마친 뒤 사용자의 PR 생성 요청에 따라 변경을 발행한다. main 병합, 프로덕션 배포·기능 활성화와 운영 Firebase 설정 변경은 별도 단계다. `package.json`에는 로컬 통합 테스트·브라우저 시험 실행 스크립트만 추가했다. lockfile 변경 및 새 의존성 설치는 없다.

- `/campus/roommates`와 영문 경로: 학교 메일 링크 인증, 모집 목록·상세·작성·수정·내 글, 모집 완료·삭제·신고·카카오 오픈채팅 연결.
- 정확한 `@syuin.ac.kr` 검증, 30일 또는 12시간의 고정 서버 세션, 인증 해제와 계정 변경 검증. 기존 관리자 Firebase 로그인과 분리된 메모리 내 학생 인증 인스턴스.
- URL 필터와 히스토리 복원, 필터 변경 시 첫 페이지 재시작, 생활습관 태그, 만료 글과 연락처 비공개.
- 기존 `/admin`의 신고·글 관리, 숨김·복구·작성 보류·연장·해제, 수정 버전 충돌 검사와 감사 기록.
- Firestore 트랜잭션으로 활성 글·신고 중복·일일 제한 관리. 만료 세션·글·신고·작성자 상태의 일일 정리와 정리 시 상태 재검사.
- 새 컬렉션의 직접 클라이언트 접근 차단, 인덱스 정의, 비공개 캐시 헤더와 검색 제외, 링크 인증 값의 GA/Sentry 노출 억제, 개인정보·운영 문서.

`ROOMMATES_ENABLED`, `ROOMMATES_WRITES_ENABLED`, `ROOMMATES_EMAIL_ENABLED`는 모두 기본 `false`다. 에뮬레이터 시험 프로세스에서만 필요한 제어 값을 켰다. 승인된 실제 메일 시험에서는 전체·메일 제어를 켜고 글 쓰기는 껐다. `.env.local`은 변경하지 않았다. 시험 종료 후 서버와 에뮬레이터를 중단했으며 3020·3031·3040·9098·8188 포트가 닫힌 것을 확인했다.

접속이 바뀌면 화면의 입력값과 React Query 자료를 제거한다. 이메일이나 작성자 키를 브라우저에 제공하는 대신, 인증용으로 사용할 수 없는 HMAC `sessionTag`로 세션 변경을 구별한다. focus·visibility·BFcache 재방문 시 검증 완료 전 private 화면을 숨기며 같은 세션의 작성 중 내용은 유지한다. 링크 완료 화면을 떠나면 임시 인증을 정리하고, 취소와 세션 발급이 경합하면 발급 쿠키도 폐기한다.

## 운영 Firebase 설정 조회와 실제 메일 확인

기존 로컬 설정의 클라이언트 및 Admin 프로젝트는 모두 `syu-campus`였다. 첫 Identity Platform 설정 조회는 HTTP 200이었고, 당시 기본 `EMAIL_SIGNIN` 발송 시험은 HTTP 400 `OPERATION_NOT_ALLOWED`로 거부됐다. 후속 검증에서는 사용자가 이메일 링크 활성화와 학교 메일 시험을 승인했다. 변경 전 설정을 다시 읽었을 때 이미 `passwordRequired: false`였으므로 PATCH는 실행하지 않았다. 재조회 전후의 다른 설정 해시도 동일했다. 누가 설정을 활성화했는지는 추정하지 않는다.

이번에는 실제 발송과 사용자의 Chrome 로그인이 성공했다. 실제 Firebase Auth의 정상 인증 기록은 생성·갱신될 수 있으며, 세션·메일 제한 자료는 `FIRESTORE_EMULATOR_HOST=127.0.0.1:8188`을 고정한 로컬 DB에 저장했다. 운영 Firestore 자료에는 쓰지 않았다. 학교 메일 주소와 인증 링크 원문은 이 문서에 기록하지 않는다.

| 항목 | 확인 결과 |
| --- | --- |
| 이메일 제공자 | `enabled: true` |
| 비밀번호 요구 | 첫 조회는 true. 후속 조회는 false로 이메일 링크 활성화 확인; 이번 작업에서 PATCH 없음 |
| 허용 도메인 | `localhost`, `syu-campus.firebaseapp.com`, `syu-campus.web.app` |
| 운영 앱 도메인 | `campus.syu.kr`은 허용 목록에 없음 |
| 요금제·결제 | Cloud Billing 조회 HTTP 403. 권한 부족으로 확인하지 못했으며 요금제를 추정하지 않음 |
| 별도 테스트 프로젝트 | 사용자가 아직 만들지 않았다고 확인 |
| 실제 학교 메일 수신 | 후속 시험에서 앱 발송 API HTTP 200. 사용자가 수신·주소 재입력 후 Chrome 로그인·재방문·로그아웃 후 차단을 확인 |

`passwordRequired`의 의미는 [Identity Platform Config 문서](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/Config), 제공자와 허용 도메인 조건은 [Firebase 웹 이메일 링크 인증](https://firebase.google.com/docs/auth/web/email-link-auth), 발송 한도는 [Firebase Authentication limits](https://firebase.google.com/docs/auth/limits)를 기준으로 확인했다. 기본 발송기를 사용하는 코드이며 별도 SMTP나 숫자 OTP 제공자는 요구하지 않는다.

## 자동 검증

당시 코드에서 `npm run check`가 종료 코드 0으로 통과했다. 단위 검사와 별도 로컬 통합 검사를 구분한다. 아래 단위 검사에는 모의 응답이 포함되며, Auth·Firestore 동작은 다음 절의 실제 로컬 에뮬레이터로도 확인했다. 운영 Firebase 연동 및 실제 메일 수신 성공의 증거로 취급하지 않는다. 추가 검사 후 최신 결과는 문서 마지막 절과 [공개 전 검증표](./ROOMMATE_BOARD_RELEASE_VALIDATION.md)에 기록한다.

| 검사 | 실제 결과 |
| --- | --- |
| lint, TypeScript, i18n, TWA, knip | 모두 통과 |
| Python | 18개 스크립트 문법, 크롤러 격리·신뢰 경계, 월간 데이터 검사 통과 |
| 졸업·교육과정·크롤링 자료 | 모두 통과. 기존 요람 원본 PDF 2개가 없어 해시 검사를 건너뛰었다는 기존 안내는 유지 |
| Vitest | 후속 수정 후 79개 파일, 391개 테스트 통과 |
| production build | Next.js 16.3.6 빌드 성공. 룸메이트 보호 페이지와 API가 동적 경로로 생성 |
| Git | `git diff --check` 통과. package.json은 통합·브라우저 검사 스크립트만 추가; lockfile, .env.local 변경 없음 |

검사 환경의 기존 `.venv` 실행 파일은 존재하지 않는 Store Python 경로를 참조했다. 설치된 `requests`와 `bs4`를 `PYTHONPATH=.venv/Lib/site-packages`로 사용하고 Codex에 이미 포함된 Python 3.12.14를 `PATH` 앞에 배치해 검사했다. 새 Python 패키지를 설치하지 않았다.

첫 구현의 전체 테스트는 381개 성공·1개 실패였다. 실패는 기존 `tests/eslint-root-glob.test.ts`의 자식 프로세스 실행 10초 제한 초과(`ETIMEDOUT`)였고 룸메이트 테스트 실패는 없었다. 설치된 Vitest의 `VITEST_MAX_WORKERS=4` 설정으로 병렬 수를 제한해 필수 검사 전체를 다시 실행했고 통과했다. 중지 화면 로그아웃 경로 누락을 수정한 첫 구현은 384개 테스트와 전체 검사를 통과했다. 다음 검증은 386개였고, 아래 오류 수정과 경계 검사 추가 후 최종 `npm run check`는 391개 및 production 빌드까지 종료 코드 0으로 통과했다. 기존 테스트나 시간 제한은 변경하지 않았다.

이 환경에서 사용한 실행 명령은 아래와 같다. Python 경로는 이미 설치된 로컬 도구이며 Firebase 설정이나 비밀값을 포함하지 않는다.

```powershell
$env:PYTHONPATH = (Join-Path (Get-Location) '.venv/Lib/site-packages')
$env:Path = 'C:/Users/ssb50/.cache/codex-runtimes/codex-primary-runtime/dependencies/python;' + $env:Path
$env:VITEST_MAX_WORKERS = '4'
npm run check
```

## 실제 로컬 Auth·Firestore 통합 검증

별도 테스트 Firebase 프로젝트가 없어 `demo-syu-roommates` 프로젝트의 로컬 에뮬레이터를 사용했다. 이미 설치된 Firebase CLI 15.29.0, Java 22.0.2와 캐시된 Firestore 에뮬레이터 1.22.0을 사용했으며 새 도구나 의존성을 설치하지 않았다. Auth는 `127.0.0.1:9098`, Firestore는 `127.0.0.1:8188`에만 열었다.

`npm run test:roommates:integration`은 당시 후속 수정 후 실행에서 종료 코드 0, 1개 파일·9개 테스트 통과, 18.57초였다. 앱의 실제 Route Handler와 Firebase Admin·웹 SDK를 호출하며 다음을 검증했다.

| 검증 | 실제 결과 |
| --- | --- |
| 기본 이메일 링크 | 로컬 `EMAIL_SIGNIN` 링크 발급, 웹 SDK 소비 성공, 동일 링크 재사용 거부 |
| 서버 세션 | 실제 Auth 토큰으로 30일·12시간 세션 발급, 쿠키 속성, 해시 저장, 세션 재확인·로그아웃 후 폐기 |
| 접근과 제한 | 미인증·잘못된 학교 도메인·다른 Origin 거부, 메일 재요청 제한 |
| 글과 신고 | 실제 동시 작성에서 1건 성공·1건 충돌, 목록 필터, 타인 수정 거부, 본인·중복 신고 거부 |
| 상태와 보존 | 수정 버전 충돌, 모집 완료·삭제, 최초 보존 시각 유지와 활성 글 포인터 해제 |
| 관리자 | 실제 admin 토큰으로 숨김·작성 보류·복구·보류 해제·신고 처리, 권한 거부와 감사 기록 |
| 인증 폐기 | 실제 Auth 사용자 비활성·삭제·토큰 폐기·이메일 변경과 세션 만료를 HTTP 401로 처리 |
| Firestore Rules | 네 비공개 컬렉션에 비인증·인증 클라이언트의 직접 읽기·쓰기 모두 HTTP 403 |
| 정리 | 만료 세션·글·신고 삭제, 미처리 신고 감사 기록, 작성 보류 상태와 Auth 사용자 보존 |

설정과 하네스는 `demo-syu-roommates` 및 지정한 loopback 주소만 허용한다. `.env.local`과 서비스 계정을 불러오지 않고 독립 임시 비밀값을 사용한다. 테스트의 메일 요청 어댑터는 정확한 기본 발송 API만 로컬 Auth로 연결하며 다른 외부 `fetch` 요청은 차단한다. 각 시험에서 외부 요청 시도가 0임을 확인했다. 시험 사이의 초기화는 이 로컬 demo 프로젝트에만 수행했고 운영 자료에 쓰지 않았다. 프로덕션 코드에는 에뮬레이터 우회 경로를 추가하지 않았다.

Firebase CLI가 PATH에 있고 위 포트가 비어 있을 때, 두 터미널에서 다음처럼 재현할 수 있다. 일반 `npm run check`와 통합 검사는 별도로 실행한다.

```powershell
# 터미널 1
firebase emulators:start --only auth,firestore --project demo-syu-roommates --config firebase.roommates.emulators.json

# 터미널 2
npm run test:roommates:integration
```

[Auth 에뮬레이터는 실제 메일을 발송하지 않으며](https://firebase.google.com/docs/emulator-suite/connect_auth), [Firestore 에뮬레이터는 복합 인덱스 준비 여부와 운영의 모든 제한을 검증하지 않는다](https://firebase.google.com/docs/emulator-suite/connect_firestore). 이 검사는 로컬 Route Handler 수준의 실제 SDK 통합이며 실제 브라우저 로그인·운영 네트워크·메일 전달·인덱스 준비 완료의 검증은 별도다.

## 검증 중 수정한 오류

1. 숨겨진 글 A 이후 새 글 B를 작성·완료하고 관리자가 A를 복구하면 `latest_post_id`가 B를 가리켜 내 글에 복구한 A가 나타나지 않았다. 복구 트랜잭션에서 활성 글과 최근 글 포인터를 함께 갱신하고 이 전체 순서를 회귀 테스트로 확인했다.
2. Next.js `NextRequest`가 로컬 `127.0.0.1` 주소를 `localhost`로 정규화해 같은 사이트의 로그아웃을 잘못된 Origin으로 거부했다. 정확한 loopback Host와 동일 포트만 원래 주소로 복원하도록 수정했다. 외부 Host·forwarded-host 조작 및 다른 Origin 거부 회귀 테스트와 독립 검토를 진행했다.
3. Firestore Timestamp 범위보다 큰 목록 cursor를 decoder가 통과시켜 HTTP 503으로 분류했다. decoder의 기존 try/catch 안에서 실제 Timestamp 생성으로 범위를 검증해 `400 INVALID_CURSOR`로 처리한다. 범위 초과 2개를 재현하고 수정 후 통과했다.
4. CI의 Knip이 에뮬레이터 테스트 설정을 읽으면서 CI placeholder 프로젝트를 환경 불일치로 거부했다. 환경 제한은 Vitest가 실제 검사를 실행할 때 적용하고, Knip의 설정 읽기는 허용한다. CI와 같은 프로젝트 값에서 Knip 및 전체 검사가 통과했으며, 같은 값으로 통합 검사를 실행하면 시작 단계에서 여전히 거부됨을 확인했다. 지정된 demo·loopback 에뮬레이터의 통합 9개도 재실행해 통과했다.

후속 경계 검사는 로그아웃 DB 삭제 실패 후 재시도, 소비한 링크의 세션 재시도 5분 만료, 일반 HTTP 503 후 동일 세션·작성 입력 복구도 확인했다. 새 검사 5개를 포함한 집중 검사 4개 파일·28개 테스트, 전체 단위 검사 79개 파일·391개 테스트와 타입·lint 검사가 통과했다.

## 후속 실제 브라우저·메일 검증

### 로컬 학생 게시판

에뮬레이터 실행 후 `npm run test:roommates:browser`로 `http://127.0.0.1:3031/_roommate_test`를 연다. 이 시험 도구는 가상 학생 A/B의 로컬 Auth 링크를 서버에서 소비하고 실제 Next 세션 API가 발급한 쿠키를 정상 HTTP 응답으로 전달한다. 제품 인증을 우회하는 운영 경로는 추가하지 않았다. 도구로 넣은 가상 학생 세션이며 실제 메일 로그인 증거와 구분한다.

실제 브라우저에서 A의 폼 작성·저장(HTTP 201), B의 상세·연락 링크 조회와 신고 접수(HTTP 201), A의 모집 완료(HTTP 200)를 확인했다. A에게 본인 관리 제어가 있고 B에게 신고 제어가 나타났다. 두 탭에서 로그인 상태를 연 뒤 한 탭의 로그아웃으로 양쪽의 글·생활습관 정보가 제거되고 인증 화면으로 이동했다. 뒤로가기도 이전 글을 복원하지 않고 인증 화면으로 이동했다. 브라우저가 실제 Secure·HttpOnly 쿠키를 받아 서버 인증 상태를 확인한 흐름이다.

Next의 기존 환경 로더를 시험 도구에서 가로채 `.env` 로딩을 두 번 건너뛴 것을 확인했다. 서버 측 외부 fetch 전송은 0건이고 차단 시도는 1건이었다. 차단 대상 host를 기록하지 않아 그 대상은 추정하지 않는다. 시험 도구의 HTML form에만 `same-origin` referrer 정책을 적용하며 제품의 `no-referrer` 정책은 유지한다. 이 Next 버전의 저장소 dev lock 때문에 학생 시험 서버와 실제 메일 시험 서버는 순서대로 실행했다.

### 실제 학교 메일과 Chrome

사용자가 승인한 실제 Firebase Auth와 기존 로컬 클라이언트 설정으로 `http://localhost:3040` 개발 서버를 열었다. localhost 메일 callback은 앱의 개발 모드에서만 허용된다. 쓰기는 중지하고 Firestore는 loopback 에뮬레이터로 고정했으며 독립 임시 HMAC 값을 썼다. 실제 앱의 인증 폼에서 제공한 학교 주소로 메일을 요청했고 `POST /api/roommates/auth/request-link` HTTP 200과 발송 성공 안내를 확인했다.

사용자는 받은 메일 링크를 Chrome에서 열고 학교 주소를 한 번 입력한 뒤 게시판에 진입했다고 확인했다. 발송한 Codex 브라우저와 Chrome의 저장소가 달라 주소 재입력이 필요했다. 다른 브라우저에서는 수신 이메일을 다시 입력받는 [Firebase 공식 이메일 링크 인증 흐름](https://firebase.google.com/docs/auth/web/email-link-auth)과 일치한다. 첨부 화면에서 완료 URL query가 제거된 상태도 확인했다.

서버에서도 실제 Auth 토큰 검증 후 `POST auth/session` HTTP 200, 세션 재확인·목록·내 글 API HTTP 200을 확인했다. 사용자가 같은 Chrome에서 탭을 닫았다가 다시 열 때 메일 없이 진입하고, 로그아웃·뒤로가기 후 인증 화면으로 이동함을 확인했다. 서버의 로그아웃 HTTP 200과 보호 페이지의 인증 리다이렉트도 일치했다. 30일 전체 경과나 실제 휴대폰·카카오 인앱·설치 앱은 이 PC 시험으로 검증하지 않았다. 실제 메일 재발송·메일함 스팸 분류·이미 소비한 실제 메일의 재사용·다른 수신 기기 시험도 별도다.

### 운영 인덱스·익명 접근 읽기 전용 확인

Firestore 인덱스 목록 API는 HTTP 200이었다. 최초에는 `status ASC, created_at DESC, __name__ DESC` 필드만 대조해 목록 인덱스를 READY로 기록했으나, 공개 전 재검증에서 그 인덱스의 이름은 `site_inquiries`와 `campus_tip_suggestions` 컬렉션에 속함을 확인했다. 이 판정을 정정한다. 컬렉션 그룹 이름·query scope·필드 순서까지 대조한 결과 저장소의 룸메이트 필수 인덱스 네 개 모두 MISSING이다. 인덱스 생성·배포는 수행하지 않았다. [공식 인덱스 목록 API](https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.collectionGroups.indexes/list)로 확인했으며 에뮬레이터 결과로 준비 상태를 대신 판단하지 않았다.

네 비공개 컬렉션 각각의 존재하지 않는 가상 문서 주소를 운영 REST API에서 익명 GET으로 조회했고 모두 HTTP 403이었다. 운영 자료를 읽거나 쓰지 않았다. 이것은 현재 Rules의 익명 접근 차단 증거이며, 새 Rules 전체의 배포나 인증된 학생의 직접 접근 차단·운영 트랜잭션 검증을 대신하지 않는다.

- [로컬 가상 학생의 실제 작성·저장 화면](/C:/Users/ssb50/.codex/visualizations/2026/10/03/01a102c5-a1dd-7a61-8cb9-77c23c86c463/roommate-private-browser-test.png)

## 브라우저와 HTTP 검증

로컬 `next dev --hostname localhost --port 3001`에서 다음을 확인했다. 실제 운영 세션 발급·게시글 생성·신고·관리자 조치는 수행하지 않았다.

| 검증 | 결과 |
| --- | --- |
| 인증 화면 한국어·영어 | 각 언어의 문구와 30일 기본 선택·공용 기기 12시간 안내 확인 |
| 잘못된 메일 도메인 | `@syu.ac.kr` 입력 거부 및 입력란 오류 확인 |
| 발송 중지 | 가상 `roommate-ui-check@syuin.ac.kr` 입력 시 `EMAIL_DISABLED` 안내. 실제 발송·DB 카운터 기록 없음 |
| 반응형 | 320·768·1440px에서 가로 넘침 없음. 브라우저 viewport 검사이며 실제 휴대폰 증거는 아님 |
| 미인증 글쓰기 | `/campus/roommates/new`에서 인증 화면으로 이동하고 안전한 `next` 유지 |
| 목록·내 글·상세 API | 세 API 모두 미인증 요청에 HTTP 401, 게시글·생활습관·연락처 없음 |
| 관리자 API | 글·신고 API 모두 미인증 요청에 HTTP 401 |
| 비공개 | 위 API의 `private, no-store`; 인증·완료 화면 `noindex, nofollow`, GA 외부 스크립트 0개 |
| 링크 완료 URL | 가상 OOB 값으로 완료 화면 진입 후 query 제거 확인. Firebase 링크 소비는 실행하지 않음 |

첫 구현 빌드의 `next start --hostname localhost --port 3001`에서도 제어 값을 별도로 켜지 않고 HTTP로 확인했다. 보호 페이지는 일반 중지 안내와 로그아웃 컨트롤을 반환하고, 목록 API는 `503 FEATURE_DISABLED`였다. HTML 및 API의 `private, no-store`, HTML의 `noindex, nofollow`와 `no-referrer`를 확인했다.

후속 검증의 최종 production 빌드를 `next start --hostname 127.0.0.1 --port 3020`으로 실행했다. 실제 화면의 로그아웃 클릭 후 `/campus`로 이동하는 것을 확인했다. HTTP 검사에서 같은 `127.0.0.1:3020` Origin의 로그아웃은 `200 {loggedOut: true}`와 `Max-Age=0`, 다른 `localhost:3020` Origin은 `403 FORBIDDEN_ORIGIN`이었다. 비공개 화면·API의 캐시 및 검색 차단 헤더, 중지 목록의 `503 FEATURE_DISABLED`, 미인증 admin의 HTTP 401도 다시 확인했다. 실제 로그인 세션 없이 중지 화면의 로그아웃 경로를 확인한 것이며, 인증 세션 폐기는 위 에뮬레이터 검사에서 별도로 검증했다.

아래 세 캡처는 로컬 인증·중지 화면 시험이다. 위의 가상 학생 게시판 캡처와 구분하며 실제 메일 로그인 성공의 증거로 취급하지 않는다.

- [모바일 인증 화면](/C:/Users/ssb50/.codex/visualizations/2026/10/03/01a102c5-a1dd-7a61-8cb9-77c23c86c463/roommate-auth-mobile.png)
- [데스크톱 인증 화면](/C:/Users/ssb50/.codex/visualizations/2026/10/03/01a102c5-a1dd-7a61-8cb9-77c23c86c463/roommate-auth-desktop.png)
- [최종 빌드 로그아웃 후 캠퍼스 이동](/C:/Users/ssb50/.codex/visualizations/2026/10/03/01a102c5-a1dd-7a61-8cb9-77c23c86c463/roommate-logout-test.png)

## 활성화 전 남은 확인

1. 테스트 Firebase 프로젝트와 환경별 독립 비밀값을 준비하고 클라이언트·Admin 프로젝트 일치를 확인한다.
2. `syu-campus`의 Email link 활성화와 실제 수신은 확인했다. 운영 허용 도메인 `campus.syu.kr` 등록 및 충분한 실제 발송 한도·요금제 확인은 남아 있다. 별도 테스트 프로젝트도 사용하는 환경에서 확인한다.
3. 저장소의 Rules·인덱스를 해당 프로젝트에 반영하고 준비 완료를 확인한다. 최신 재검증에서 게시글 `status + created_at` 및 `status + recruit_until`, 신고 `status + expires_at`, 요청 제한 `metric + window_start` 인덱스 네 개 모두 미등록이다. 익명 직접 접근 거부는 확인했으며 인증 학생의 직접 접근 차단은 실제 Firebase에서 추가 확인한다.
4. 실제 학교 메일 수신·다른 PC 브라우저의 링크 완료·서버 쿠키 발급·같은 브라우저 재방문·로그아웃 후 차단은 확인했다. 실제 메일의 재발송·스팸 분류·만료·재사용·다른 수신 기기 시험은 남아 있다.
5. 실제 Firebase에서 글·신고·보류·관리자 조치·정리 및 기존 관리자 로그인 분리를 검증한다. 이 정리 명령은 운영 자료를 삭제하므로 운영 대상 테스트에 사용하지 않는다.
6. 실제 모바일·카카오 인앱 브라우저·설치 앱의 최초 인증과 재방문을 확인한다.
7. 검증 후 해당 환경의 세 제어 값을 켜고 배포한다. 전체 중지는 로그아웃·admin을 유지하고, 쓰기 중지는 본인 완료·삭제·신고를 유지하며, 메일 중지는 이미 받은 유효 링크 완료를 유지한다.

구현·단위 검사·로컬 에뮬레이터 통합과 실제 학교 메일의 PC 인증 흐름은 확인했다. 운영 데이터 흐름 전체와 실제 모바일 검증, 공개 출시는 남은 상태로 기록한다. 이번 내부 테스트로 이용 수요가 입증됐다고 판단하지 않는다.

## PR 및 배포 준비

최신 `main`은 `362708ab2cadf41805aaf37947173a93319bdcb9`로 브랜치 출발점과 일치했다. main 보호 규칙은 PR과 최신 main 기준의 `Audit and Check`, `Android TWA`, `Analyze JavaScript and TypeScript`, `Dependency Review` 통과 및 review thread 해결을 요구한다. PR 생성 단계의 전체 `npm run check`도 79개 파일·391개 테스트와 production 빌드까지 종료 코드 0으로 통과했다.

[PR #195](https://github.com/syu-kr/campus.syu.kr/pull/195)에 구현과 공개 준비 공지를 포함했다. CI 설정 호환성 수정 후 `NEXT_PUBLIC_FIREBASE_PROJECT_ID=ci-placeholder`를 설정한 로컬 전체 검사도 391개 테스트·61개 정적 페이지 빌드까지 종료 코드 0으로 통과했고, 독립 에뮬레이터 통합 검사 9개를 다시 실행해 16.05초에 통과했다. PR의 필수 CI 결과는 최종 원격 SHA에서 별도로 확인한다.

읽기 전용 Firebase 재조회에서 이메일 링크는 활성화되어 있고 `campus.syu.kr`은 여전히 미등록이었다. 공개 전 후속 검사에서 컬렉션 이름까지 대조해 이전 READY 판정을 정정했으며 필요한 네 인덱스 모두 MISSING이다. 인덱스나 인증 설정을 변경하지 않았다. Vercel 대상 프로젝트의 환경 목록을 값 공개 없이 확인한 결과 owner 비밀값과 세 룸메이트 플래그는 미등록이었다. Firebase Console의 실제 요금제는 Spark이며 사용자는 Blaze 전환을 추후 직접 진행한다고 답했다.

상단 메뉴는 윤곽선 없는 텍스트 링크와 현재 페이지의 밑줄로 변경했다. 타입·lint·관련 테스트 2개, 세 화면 사이의 선택 전환, 키보드 포커스 및 320/768/1024/1440px의 한글 메뉴 배치를 확인했다.

사용자의 요청으로 [기능 공개 공지 원고](../public/service-notices/017-roommate-board.md)를 공개 완료 문구로 수정했다. 원고 수정과 실제 공개는 구분하며, 기능이 활성화되기 전 공개 완료 원고를 운영에 게시하지 않는다. 추가 링크 오류 복구 3개와 경합·메일 중지 통합 4개를 보강한 뒤 전체 검사에서 단위 394개·빌드 61개 정적 페이지, 별도 통합 13개가 통과했다. 계획 26항목과 운영 시험의 실제 완료 범위는 [공개 전 검증표](./ROOMMATE_BOARD_RELEASE_VALIDATION.md), 실행 순서는 [배포 런북](./ROOMMATE_BOARD_DEPLOYMENT.md)을 따른다.
