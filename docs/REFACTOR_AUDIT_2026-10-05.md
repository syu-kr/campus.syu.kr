# 리팩터링·쿼리·성능 감사 — 2026-10-05

> 아래는 수정 전 감사 결과다. 이후 R01~R24의 수정·검증 결과는 [실행 기록](REFACTOR_IMPLEMENTATION_2026-10-05.md), 남은 운영 조건은 [오류 가능성 목록](REFACTOR_RISKS_2026-10-05.md)에 기록했다.

현재 체크아웃 `7b913add581f3d51affcf7743230cff816a882ea`를 대상으로 조사했다. 결과는 **우선 수정 13건(P1 1건, P2 12건), 유지보수·최적화 11건(P3), 조건부 확인 4건**이다. 구현 코드는 변경하지 않았다.

추가로 GitHub secret-scanning 알림 #1의 과거 탐지 위치·현재 설정·원격 main·운영 서비스워커를 대조하고, 공식 문서 검색과 실제 Google Cloud/Firebase 콘솔·읽기 API 검증으로 영향도를 좁혔다. 아래 S01은 코드 리팩터링 24건과 별도의 **운영 보안 확인 항목**이다.

## 범위와 판단 기준

- 추적 파일 703개를 목록화하고 app/lib/scripts/tests/vendor/workflows/types/Android의 전역 참조·쿼리·effect·저장소·예외·입력 검증 패턴을 조사했다. API route는 31개다.
- 서버/API/Firestore, 화면·상태·SDK lifecycle, 크롤러·게시·알림·유지보수·CI를 병렬 검토하고 발견 항목의 호출자를 추적했다. 핵심 경로는 현행 함수를 mock 또는 격리 입력으로 실행했다.
- 모든 파일의 모든 줄을 수동 검토한 것은 아니다. 운영 침투 시험, 부하 시험, 실제 Firestore 사용자 데이터·청구 내역 조회, 실제 단말·upstream·Android 실행, 서비스 전반의 배포 검증은 수행하지 않았다. S01에서는 운영 `/sw.js`, 키 제한, 배포 규칙, 인증 보호 설정과 제한된 읽기 API 응답을 확인했다.
- P1: 기본 화면 동작에 영향을 주므로 먼저 수정. P2: 재현 가능한 오류·입력 경계·데이터 손실/비용 방어. P3: 동작을 유지하면서 중복·불필요한 계산을 줄이는 정리.
- Knip 통과를 근거로 **자동 탐지 가능한 미사용 파일·함수·의존성은 0개**다. 아래 삭제 후보는 호출 중이지만 기능이 중복되거나 불필요한 코드다. 큰 파일·작은 래퍼·캐시의 존재만으로 결함이라 판단하지 않았다.
- 과거 감사 문서는 중복 보고와 정책 오인 방지에만 사용했으며, 현재 소스·테스트로 다시 확인했다.
- Firestore rules는 기본 deny-all이며 서버 질의는 Admin SDK로 수행한다. 따라서 서버 인증·입력 검증이 별도 경계다. 소유 토큰·학생 학교 이메일 검증·신고/글 transaction·version 충돌 처리에서 이번 조사로 구체적인 권한 우회는 확인되지 않았다. 이는 운영 보안 전체를 보증하는 결과가 아니다.

## 우선 수정 목록

| ID | 우선순위 | 위치 | 확인된 문제 | 최소 수정 방향 |
| --- | --- | --- | --- | --- |
| R01 | P1 | `proxy.ts:103-107,118-119`; `app/layout.tsx:147-149` | 응답 CSP에는 nonce가 있지만 Next 렌더러가 읽는 요청 CSP에는 없다. 수동 Script의 nonce와 달리 프레임워크 inline script의 nonce가 누락된다. | 같은 CSP를 요청 헤더와 응답 헤더에 모두 설정한다. |
| R02 | P2 | `lib/server/roommate-auth.ts:183-203`; `app/api/roommates/posts/route.ts:10`; `app/api/roommates/auth/session/route.ts:10` | 정상 형식의 임의 세션 쿠키가 DB 조회를 발생시키고 401로 종료해 요청 제한까지 도달하지 않는다. | 공통 세션 검증에서 DB 조회 전 기존 IP 제한을 적용하고 후속 소유자·세션 검증을 유지한다. |
| R03 | P2 | `lib/server/http.ts:154-165` | Content-Length가 없는 JSON 요청은 전체 본문을 메모리에 읽은 뒤 크기를 검사한다. | 읽는 중 바이트 수를 검사해 상한 초과 시 스트림을 중단한다. |
| R04 | P2 | `scripts/cleanup_old_tokens.ts:18-36`; `scripts/cleanup_meet_rooms.ts:113-128` | 만료 조회 후 삭제 사이 갱신된 FCM 구독·rate-limit 문서까지 무조건 삭제할 수 있다. | updateTime 조건부 삭제 또는 transaction 재확인을 사용한다. |
| R05 | P2 | `lib/timetable-workspace.ts:157-170`; `lib/timetable-share.ts:92`; `lib/timetable-draft.ts:152` | 중복 ID를 복구하는 기본 ID도 기존 ID와 충돌해 공유/초안의 두 시간표가 동시에 덮어써질 수 있다. | 생성할 기본 ID도 Set으로 재검사하거나 입력 단계에서 중복 ID를 거부한다. |
| R06 | P2 | `scripts/crawler_utils.py:137,164`; `scripts/run-daily-crawl.ts:41,59,143-149` | 중간 재시도 실패의 warn이 남으면 최종 수집 성공에도 incomplete로 판정해 이전 자료를 복원한다. | 재시도 로그와 최종 실패·불완전 경고를 구분한다. |
| R07 | P2 | `app/more/meet/[roomId]/page.tsx:159,351-355`; `app/api/meet/rooms/[roomId]/participants/route.ts:135,185` | 서버 저장 성공 후 localStorage 실패가 수정 토큰 반영·성공 표시·재조회를 막는다. | 토큰·성공 상태를 먼저 메모리에 반영하고 영구 저장 실패만 별도로 처리한다. |
| R08 | P2 | `lib/server/competitions.ts:504-505,528,540` | 마감일을 서버 로컬 시간대로 생성해 UTC 서버에서 한국 마감이 9시간 늦게 적용된다. | 마감 끝을 명시적인 +09:00 시각으로 계산한다. |
| R09 | P2 | `app/campus/bus-info/ShuttleSection.tsx:138,825`; `app/features/shuttle/ShuttleMap.tsx:104,186,192` | 1초 tick과 새 labels 객체가 모든 마커 재생성·화면 재정렬·선택 창 닫힘을 유발한다. | labels identity/문자열 dependencies를 안정화하고 위치 갱신 후 선택 표시를 유지한다. |
| R10 | P2 | `app/components/Modal.tsx:60,91,95`; `app/components/ContactModal.tsx:18,24`; `app/components/SubmissionResultModal.tsx:30` | 중첩 모달의 키보드 handler가 함께 실행해 Tab이 뒤쪽 창으로 이동하고 Escape가 두 창을 닫는다. | 결과를 기존 모달 안에 표시하거나 최상위 모달만 focus trap·Escape를 처리한다. |
| R11 | P2 | `app/components/WeatherWidget.tsx:19-37`; `app/components/Header.tsx:55-58`; `lib/weather.ts:15,47` | 장시간 열린 위젯이 날씨 TTL 뒤에도 갱신되지 않는다. 모달과 다른 snapshot을 표시하며 클릭 조회 실패는 처리되지 않는다. | 기존 React Query로 snapshot과 오류 처리를 공유하고 유효시간·focus 복귀 때 갱신한다. |
| R12 | P2 | `scripts/firebase-admin.ts:22-64`; `scripts/generate_announcement_ai_summaries.mjs:310-342` | 자작 env 파서가 주석 속 서비스 계정을 선택하며 CRLF 프로젝트 ID를 누락한다. | 현재 Node의 표준 env parser로 교체하고 기존 JSON의 따옴표·여러 줄 입력 계약을 검증한다. |
| R13 | P2 | `lib/server/roommate-admin.ts:206,215`; `app/admin/RoommateAdmin.tsx:42,60-61` | 페이지마다 메일 요청 합계를 위해 최대 1001개 문서를 전부 읽고 1000개까지만 합산한다. | limit(1001)을 제거하고 Firestore AggregateField.sum('count')으로 전체 합계만 조회한다. |

### R01 — CSP nonce 전달 누락

`getLocaleHeaders()`는 `x-csp-nonce`만 설정한다. 현재 설치된 Next의 `node_modules/next/dist/server/app-render/app-render.js:209-210`은 요청의 `content-security-policy` 또는 report-only 헤더에서 프레임워크 nonce를 추출한다. RootLayout이 수동 Script에 nonce를 지정해도 Next가 생성하는 inline Flight/bootstrap script에 전달하는 경로는 별개다.

현행 proxy와 설치된 Next nonce parser를 함께 실행한 결과:

```text
responseCspHasNonce: true
layoutNonceHeader: true
nextRequestCsp: null
nextFrameworkNonce: null
```

따라서 응답의 inline script 제한과 프레임워크 script nonce가 일치하지 않아 hydration/클라이언트 상호작용이 차단될 수 있다. 실제 배포의 HTML·브라우저 CSP 오류는 확인하지 않았다. 수정 완료 기준은 한국어/영어 HTML에서 프레임워크 inline script nonce가 응답 CSP와 일치하고 새로고침 후 상호작용이 동작하는 것이다. 로컬 Next CSP 가이드도 요청·응답 모두 같은 CSP를 설정한다.

### R02 — 세션 DB 조회 전 부하 방어 누락

ROOMMATES_ENABLED가 켜진 경로에서 형식에 맞는 쿠키는 먼저 세션 문서를 조회한다. 없는 쿠키이면 401로 종료하므로 뒤의 읽기 제한은 실행되지 않는다. 글 POST/PATCH/DELETE·신고도 공통 세션 검증을 먼저 호출한다.

실제 소스 + mock DB 실행: 임의 쿠키 GET 10회 → 401 10회, 세션 조회 10회, rate-limit 호출 0회. 인증 우회는 확인되지 않았다. 문제는 미인증 요청의 DB 비용·부하 방어 순서다. 공통 helper에서 기존 로컬 IP 제한을 먼저 적용하면 가장 작은 변경으로 모든 호출자를 보호한다. 인스턴스 간 공유 한도는 별도 제한 사항이며 운영 활성화 상태는 확인하지 않았다.

### R03 — 본문 제한이 소비 상한으로 작동하지 않음

`readJsonBody()`에 Content-Length 없는 3×1024B 스트림과 maxBytes=512를 전달했을 때 3072B를 모두 소비한 다음 413을 반환했다. 모든 JSON 쓰기 API에 공통으로 적용된다.

수정 완료 기준은 상한을 넘긴 청크에서 읽기를 중단하고 JSON 파싱을 실행하지 않는 것이다. 이 저장소의 `read-response-bytes.ts`에 이미 같은 제한 방식이 있다. Vercel의 별도 본문 제한과 실제 공격 시 메모리 사용량은 측정하지 않았다.

### R04 — 정리 작업의 조회→삭제 경쟁

- FCM: 오래된 토큰 조회 → subscribe API가 같은 문서의 last_updated 갱신 → 기존 batch가 활성 문서 삭제.
- Rate limit: 만료 조회 → 같은 문서 ID를 재사용하는 limiter가 새 window로 갱신 → cleanup batch가 새 카운터 삭제.

`app/api/notifications/subscribe/route.ts:51-62`, `lib/server/http.ts:242-252`에서 갱신 경로를 확인했다. 토큰은 수신 대상을 잃고 카운터는 제한을 초기화할 수 있다. 이미 `scripts/roommate-cleanup.ts`에 transaction 재확인 패턴이 있으므로 참고할 수 있다. 실서비스 경쟁 실행은 하지 않았다. 회귀 검사는 정리 쿼리 직후 갱신을 삽입해 최신 문서가 남는지를 확인해야 한다.

### R05 — 시간표 중복 ID 복구 오류

현행 공유 parser가 다음 입력을 수락한다:

```text
activeTimetableId = timetable-2
timetables = [{ id: timetable-2, courseIds: [A] },
              { id: timetable-2, courseIds: [B] }]
```

normalize 결과에도 두 ID가 모두 timetable-2다. 이후 timetable-2에 C를 추가하면 두 시간표가 모두 [A,C]가 되어 B가 사라진다. 공유 입력·초안 복원·저장 변환이 같은 정규화 함수를 사용한다. 일반 UI가 새로 만드는 정상 ID에서는 발생하지 않지만 입력 정규화 경계가 깨져 있다. 중복/빈 ID의 생성 충돌 검사와 독립 수정 검사가 필요하다.

### R06 — 재시도 성공 자료가 복원으로 무효화됨

실제 Python 함수 AST를 fake session으로 실행해 500→200일 때 2회 요청 후 정상 결과를 반환하면서 `[warn]` 로그가 남는 것을 확인했다. 실제 runner의 정규식은 그 로그를 incomplete=true로 분류한다. 최종 exit=0이어도 이전 바이트를 복원한다.

재시도 성공은 정상 자료로 게시하고, 재시도 소진·실제 불완전 자료는 원래의 보존 정책을 유지해야 한다. 현재 helper 테스트는 복구 성공을 검사하지만 runner와의 로그 계약은 검사하지 않는다.

### R07 — 서버 성공이 저장소 오류로 실패처럼 바뀜

참가자 토큰은 신규 등록 시에만 서버가 반환한다. 클라이언트는 localStorage 쓰기 다음에 state를 반영하므로 quota/SecurityError 때 토큰을 잃고 성공 표시도 생략한다. 같은 닉네임으로 재시도하면 수정 토큰이 없어 권한 오류가 날 수 있다. 닉네임 변화 시 getItem도 예외 처리가 없다.

브라우저 영구 저장이 실패하더라도 현재 세션의 토큰·서버 성공을 보존하고 영구 저장 불가만 안내한다. 실제 브라우저 storage 차단 상태와 Firestore 저장은 실행하지 않았다. 완료 검사는 성공 응답 후 storage만 throw할 때 현재 세션에서 재수정 가능한지 확인하는 것이다.

### R08 — 한국 날짜 마감의 서버 시간대 의존

현행 getCompetitionPage를 UTC 런타임·mock source/AI로 실행했다. 마감은 2026.10.05, 현재는 2026-10-06 00:10 KST인데 상태가 open으로 남았다. 기대값은 closed다.

끝 시각을 `2026-10-05T23:59:59.999+09:00`처럼 명시적으로 계산한다. 연도 생략 처리도 한국 날짜 기준으로 정한다. 운영 TZ는 확인하지 않았으며 기존 키워드 tests만으로 이 경계를 검증할 수 없다.

### R09 — 매초 셔틀 지도 객체 재생성

실제 ShuttleMap + React/Testing Library + mock Kakao SDK를 사용했다. 같은 위치·선택 ID에서 값이 같은 새 labels 객체로 rerender하자 marker created 2→3, detached 1→2, opened 1→1, closed 1→2, recentered 3→4이고 선택 InfoWindow가 보이지 않았다.

부모의 1초 now 갱신과 연결된 현상이다. 시간 표시 갱신이 지도 객체 lifecycle을 실행하지 않도록 dependencies를 제한하고, 실제 위치가 바뀔 때에도 선택 창은 유지해야 한다. 실제 Kakao upstream은 호출하지 않았다.

### R10 — 중첩 모달 focus trap 충돌

실제 shared Modal + React/Testing Library + jsdom에서 외부 입력 창을 먼저 연 뒤 내부 결과 창을 열었다. 결과 확인 버튼의 Tab은 외부 닫기 버튼으로 이동했고 Escape는 외부/내부 onClose를 각각 1회 호출했다. 가시성 판정은 getClientRects mock을 사용했다.

문의와 생활팁 제안의 결과 창 경로가 영향 대상이다. 하나의 모달 안에서 성공/실패 화면을 전환하는 방식이 구조를 가장 적게 늘린다. 중첩이 계속 필요하면 최상위 창만 키보드를 처리한다. body overflow 복구 문제는 재현되지 않아 제외했다.

### R11 — 날씨 snapshot·오류 처리 분산

Widget은 mount/언어 변경 때만 fetch하고 Header의 모달 클릭은 별도 fetch와 state를 사용한다. lib 캐시의 5분 TTL이 지나도 이미 표시된 위젯 state를 갱신하는 동작은 없다. 클릭 경로의 await에는 catch가 없어 upstream 오류가 unhandled rejection으로 끝날 수 있다.

이미 설치된 React Query를 활용해 Widget/Modal이 같은 snapshot·에러 상태를 소비하도록 한다. 새 cache 계층은 필요 없다. 장시간 열린 화면의 갱신과 실패 후 재시도를 검증한다.

### R12 — 표준 env 파서로 자작 파서 제거

합성 CRLF env를 실제 loadEnvLocal에 전달하니 주석의 commented-example 계정을 채택하고 프로젝트 ID를 누락했다. 동일 입력의 node:util.parseEnv는 실제 계정과 프로젝트 ID를 정상 반환했다. 실제 비밀 값은 보고서에 읽거나 기록하지 않았다.

Node 런타임은 이미 고정돼 있으므로 process.loadEnvFile 또는 util.parseEnv를 사용할 수 있다. 기존 환경변수 우선순위를 유지하고 서비스 계정의 한 줄/따옴표로 감싼 여러 줄 JSON 입력을 확인한 뒤 두 파서를 정리한다. 현재 비표준 따옴표 없는 여러 줄 형식을 허용한다면 먼저 표준 형식으로 등록하는 절차가 필요하다.

### R13 — 목록 조회마다 1001개 문서를 읽는 합계

글/보류 목록 페이지와 더 보기에서 api_rate_limits 문서를 최대 1001개 가져와 count 필드를 reduce한다. 1000개를 넘으면 partial 표시가 붙는 합계다.

현재 설치된 Firestore types에서 AggregateField.sum을 확인했다. 같은 필터에서 limit(1001)을 제거하고 서버 합계를 요청하면 전체 문서 전송과 임의 1000개 절단을 줄인다. 별도 counter 컬렉션이나 새 의존성은 필요 없다. 실제 일별 문서 수·요금·응답 지연은 확인하지 않았다.

## 유지보수·최적화 목록

추상화 추가보다 삭제·기존 코드 재사용을 우선한다. 아래는 긴급 장애 수정과 구분한 P3다.

| ID | 태그 | 위치 | 정리할 내용 / 대체 |
| --- | --- | --- | --- |
| R14 | reuse | `app/api/admin/submissions/route.ts:72,180,283,306` | 상태별 집계 뒤 pagination total을 같은 상태로 다시 집계한다. 기본 요청은 집계 12개이며 pending 집계가 컬렉션마다 중복이다. status가 all이 아닐 때 기존 counts[status]를 재사용한다. all의 전체 count는 유지한다. |
| R15 | shrink | `lib/server/announcements.ts:69,78,99,181` | source가 같은 60초 동안에도 페이지마다 정렬·날짜 파싱을 반복한다. source cache 생성 때 날짜와 정렬 결과를 재사용한다. 전체 날짜 정렬과 카테고리 고정·중요 우선 정렬을 보존한다. |
| R16 | shrink | `app/campus/map/page.tsx:20`; `app/campus/map/components/MapView.tsx:101`; `app/campus/map/components/BuildingMarker.tsx:30,106,110` | 선택 callback identity가 건물 marker·SVG·listener 재생성을 유발한다. callback/dependencies를 안정화하고 cleanup에서 InfoWindow·listener도 정리한다. |
| R17 | delete | `lib/api.ts:58,105,227,253`; `lib/server/http.ts:39,51`; `scripts/crawl_department_notices.py:737-745` | 그대로 throw하는 catch 4개, apiErrorResponse와 같은 apiServerErrorResponse, 이미 공통 helper가 처리한 RequestException을 다시 잡는 safe_request_soup wrapper를 제거한다. 원래 함수로 호출을 통일한다. |
| R18 | reuse | `lib/api.ts:148-229`; `lib/server/home-data.ts:38-75` | 같은 식단 JSON을 CafeteriaMenu로 바꾸는 변환이 중복이다. 기존 lib/cafeteria.ts에 순수 변환 하나를 두고 두 입구가 재사용한다. 서로 다른 fetch/에러·날짜 필터 정책은 보존한다. |
| R19 | reuse | `lib/server/crawl-data.ts:143-173`; `lib/server/read-response-bytes.ts:1-36` | 응답 스트림의 content-length·청크 바이트 제한 코드가 중복이다. 기존 reader를 재사용하고 Pages 크기/hash 검증은 유지한다. R03은 요청 스트림이므로 입력 종류 차이를 고려한다. |
| R20 | delete | `lib/api.ts:102,363,401`; `lib/fetch-json.ts:1-13,36` | 현재 client 호출에 넣은 next.revalidate는 브라우저 fetch 캐시를 설정하지 않는다. HTTP 헤더와 React Query staleTime을 실제 정책으로 남기고 사용되지 않는 server 옵션 계약을 정리한다. |
| R21 | native | `lib/serviceNotices.ts:125,131,170` | async API 안의 readdirSync/readFileSync가 요청 중 서버 실행을 차단한다. fs/promises로 바꾸고 목록/상세의 중복 frontmatter→metadata 변환을 공유한다. 현재 공지 규모에서 긴급한 지연을 입증한 것은 아니다. |
| R22 | reuse | `app/features/phone/PhonePageClient.tsx:166-201`; `app/features/campus-tips/CampusTipsPageClient.tsx:326-363`; `app/components/PaginationControls.tsx:23` | 같은 페이지 버튼·이전/다음 범위 처리를 각 화면이 다시 구현한다. 기존 PaginationControls를 재사용하고 새 pagination 계층은 만들지 않는다. |
| R23 | delete | `twa-android/app/src/main/java/kr/syukr/campus/LauncherActivity.java:45-53`; `twa-android/app/src/main/java/kr/syukr/campus/DelegationService.java:7-12`; `twa-android/app/src/main/java/kr/syukr/campus/Application.java:24-28` | 부모 호출/반환만 하는 override 3개를 삭제한다. 클래스 삭제는 Manifest 연결을 같이 수정할 때만 한다. Android 8 orientation 호환 처리는 유지한다. |
| R24 | reuse | `app/features/home/HomePageClient.tsx:202`; `lib/api.ts:286,298,331-369` | 홈 검색은 React Query signal을 소비하지 않아 빠른 재검색 뒤 이전 3개 source 요청이 끝까지 진행한다. 기존 목록 API처럼 signal을 검색 helper→fetch까지 전달한다. query key가 달라 결과 오염은 아니다. |

### 계산량과 삭제 판단의 근거

- R14: 현행 GET + mock DB에서 200, aggregateCalls=12, pending 집계 4회 확인. 실제 지연은 측정하지 않았다.
- R15: 현재 번들 공지 5280개로 현행 함수를 실행했다. 첫 페이지 Date 생성 28,274회, 11페이지 311,014회, 로컬 약 398.6ms였다. AI attach만 mock이며 CDN/실서버 응답 성능 수치는 아니다.
- 현재 공지 번들 본문이 비어 있어 목록의 full-content payload를 유의미한 성능 문제로 보고하지 않았다.
- R17의 함수들은 운영 호출과 테스트 patch에서 참조된다. 미사용 함수 삭제가 아니라 중복 행동 제거이며, 호출/테스트 이름 변경도 포함한다.
- lib/public-transit.ts의 catch는 출처별 오류 로그를 남기므로 같은 삭제 후보로 취급하지 않았다.
- R20의 Next fetch 가이드는 browser cache와 server persistent cache를 구분한다. 현재 실제 호출자는 Home/CampusTips 등 client 경로다.
- R18/R19/R17 및 env parser 정리는 대략 100~150줄 순감소 가능성이 있다. 정확한 삭제량은 구현 후 diff로 확인해야 한다. 설치 의존성 제거 후보는 이번 감사에서 확정하지 않았다.

net: 약 -100~150 lines, -0 deps possible. 추정치이며 수정 결과가 아니다.

## 조건부 확인·정책 항목

다음은 확인된 구현 경계 또는 운영 선택이지만 공격 성공·현행 장애로 확정하지 않았다.

1. **관리자 이메일 검증:** `lib/server/admin-auth.ts:55-65`는 allowlist 이메일만 보고 email_verified/UID를 요구하지 않는다. `lib/server/admin-auth.test.ts:7-16`도 미검증 이메일 허용을 명시한다. 관리자 계정 사전 등록·공개 계정 생성·Firebase 인증 정책을 확인한 뒤 verified 이메일/등록 UID 요구 여부를 정한다. 허용된 이메일의 미검증 계정을 공격자가 만들 수 있어야 실제 권한 탈취 경로가 성립한다. 현재 설정은 미확인이다.
2. **AI 원문 redirect 경계:** `scripts/generate_announcement_ai_summaries.mjs:423-434,491-503`은 최초 URL만 학교 allowlist로 검증하고 redirect 목적지/최종 response.url을 검사하지 않는다. redirect:error 또는 hop별 allowlist 검사로 강화할 수 있다. 실제 학교 사이트의 open redirect는 확인하지 않아 운영 SSRF로 단정하지 않는다.
3. **분산 공개 읽기 제한:** 공유 시간표/모임 읽기는 persistent:false와 process-local Map을 사용한다. 이미 문서화된 한계이며 인스턴스/재배포 간 요청 총량을 통제하지 못한다. 트래픽·DB 비용 근거를 보고 플랫폼 또는 기존 공유 제한 적용을 결정한다. 신규 Redis 도입을 선행 권고하지 않는다.
4. **금·토 공지 알림:** 평일 오전 발송이 전날만 집계해 금·토 공지가 정규 발송에 포함되지 않는 동작을 확인했다. 그러나 `docs/SITE_AUDIT_2026-10-04.md:51`에 소급하지 않는 기존 정책이 명시되어 있다. 버그 목록에서 제외한다. 변경하려면 월요일 금~일 집계·문구·중복 방지 정책을 먼저 정해야 한다.

## 제외한 과한 수정

- vendor의 brace-expansion-compat/eslint-root-glob는 보안 호환 목적과 소비 API 계약이 있다. 단순 삭제나 override 제거를 권하지 않는다.
- React Query, Firebase, Sentry, OpenAI 등 실제 사용 중인 의존성을 일반론만으로 제거하지 않는다.
- 시간표/졸업/i18n 파일이 크다는 이유만으로 파일 분할이나 새로운 service/repository/factory 계층을 추가하지 않는다.
- 페이지가 줄었을 때 usePagination이 clamp하지 않는 경계는 확인했지만, 정상 사용의 영향 경로가 충분히 재현되지 않아 별도 확정 버그로 올리지 않았다.
- fetchJson에서 caller signal과 timeoutMs를 동시에 쓰면 자체 timeout이 꺼지는 것을 확인했다. 현재 양쪽을 동시에 넘기는 운영 호출자가 없어 장애 항목에서 제외했다. 향후 병용 시 AbortSignal.any로 합성하면 된다.
- 과거 .next 산출물의 졸업/locale chunk 크기를 현재 production 성능으로 제시하지 않았다.

## 추가 보안 확인 S01 — secret-scanning 알림 #1

2026-10-05에 인증된 GitHub REST API로 [알림 #1](https://github.com/syu-kr/campus.syu.kr/security/secret-scanning/1)을 읽었다. 해당 API 키의 실제 값은 도구 출력·보고서에 기록하지 않았다. 동일 프로젝트의 기존 자격으로 읽기 API를 조회하고, 기존 로그인 브라우저에서 콘솔 설정을 확인했다.

**최종 판정: 키 공개 자체는 정상 Firebase 클라이언트 구성이다. 현재 운영 Firestore 접근 차단과 직접 Gemini 접근 차단을 확인했으며, 이 키만으로 관리자 권한·전체 푸시 발송 권한을 얻는 근거는 없다. 다만 직접 Auth 요청의 남용 방어와 실제 사용보다 넓은 API 허용 범위는 보완할 대상이다. 즉시 키 폐기를 요구하는 침해나 과금 피해는 이번 조사에서 확인되지 않았다.** 이는 남용 발생이 전혀 없었다는 보증은 아니다.

| 확인 항목 | 결과 |
| --- | --- |
| 알림 상태 | `open`, 유형 `google_api_key` / Google API Key |
| 생성 시각 | 2026-06-12 16:13:31 UTC / 2026-06-13 01:13:31 KST |
| GitHub 판정 | `validity: unknown`, `publicly_leaked: true`, `multi_repo: false` |
| 탐지 위치 | 커밋 `0a51029752803de2437d19cb38dda40d03d7c8b2`의 `lib/firebase.ts:9`, `public/sw.js:14` |
| 과거 코드 용도 | 두 위치 모두 `firebaseConfig.apiKey`; 서버 서비스 계정의 private key가 아님 |
| 현재 추적 파일 | 탐지된 키의 정확한 문자열 일치 없음 |
| 로컬 설정 | 무시되는 `.env.local`의 `NEXT_PUBLIC_FIREBASE_API_KEY`와 정확히 일치 |
| 원격 main | `539cc9bda88d678ce2008366079b982d3f6db6ae`의 Firebase 클라이언트·서비스워커는 환경변수 참조; 조사한 네 파일에는 키 literal 없음. 원래 감사한 로컬 HEAD와 다른 스냅샷이다. |
| 운영 응답 | `https://campus.syu.kr/sw.js` HTTP 200 / application/javascript. `firebase.initializeApp` 설정에 탐지된 것과 정확히 같은 키 포함 |
| 열린 알림 | 조회 시점에 1개, 이 알림 #1 |
| 저장소 보호 | GitHub secret scanning·push protection 활성, validity checks 비활성 |
| 콘솔 키 식별 | 현재 Firebase 웹 앱의 `apiKeyId`가 콘솔에서 조사한 Browser key ID와 일치 |
| API 제한 | 25개 API allowlist 적용. Generative Language API·Maps API는 포함되지 않음 |
| 애플리케이션 제한 | 없음. 브라우저 출처·IP·앱 식별 제한 미적용 |
| 실제 Firebase Auth 조회 | 같은 키로 프로젝트 공개 설정 GET → HTTP 200. 현재 Auth API가 이 키를 수락함 |
| 실제 Gemini 조회 | 같은 키로 모델 메타데이터 GET 1회 → HTTP 403 / `API_KEY_SERVICE_BLOCKED` |
| 실제 운영 Firestore 규칙 | Rules API의 배포 소스가 저장소와 일치. 16개 allow 절이 모두 `if false`; release 갱신 2026-10-04 08:54:57 UTC |
| App Check / AI Logic | 콘솔에서 둘 다 `시작하기` 초기 화면. App Check 구성과 AI Logic 사용 설정을 완료한 증거 없음 |
| Auth 운영 설정 | 공개 가입 허용, 이메일 열거 보호 활성. 가입 제한 100회/IP/시간. Identity Platform 미업그레이드 |
| 요금제·관측 | 콘솔 Blaze. 현재 결제 기간 Auth 화면은 최대 일일 활성 4명·월간 활성 2명 표시. 이는 메일/실패 요청량·키별 남용량이나 청구 내역 검증이 아님 |

2026-06-13의 커밋 `1ec16a3`에서 클라이언트 설정은 환경변수로 전환됐고 정적 `public/sw.js`는 동적 `app/sw.js/route.ts`로 옮겨졌다. 현재 [lib/firebase.ts:7](C:/Users/ssb50/Project/syu-campus/lib/firebase.ts:7), [lib/firebaseRoommates.ts:14](C:/Users/ssb50/Project/syu-campus/lib/firebaseRoommates.ts:14), [app/sw.js/route.ts:9](C:/Users/ssb50/Project/syu-campus/app/sw.js/route.ts:9)가 같은 공개 환경변수를 사용한다. 서비스워커는 [route.ts:44](C:/Users/ssb50/Project/syu-campus/app/sw.js/route.ts:44)에서 그 설정을 응답으로 직렬화한다. 따라서 **소스의 literal 제거와 환경변수 전환만으로 키 공개가 해소되거나 키가 교체된 것은 아니다.** 운영 응답의 문자열 일치는 사용 설정의 증거이며, Google API가 그 키를 현재 수락한다는 검사는 아니다.

Firebase 클라이언트 키는 프로젝트 식별용이며 데이터 권한은 별도 통제로 결정된다. 공개 키에 필요한 API 제한을 적용하고 데이터 접근을 보호해야 하며, 공개 키에 Generative Language API를 허용하면 안 된다. 이 구분은 [Firebase 공식 키 관리 문서](https://firebase.google.com/docs/projects/api-keys)에 따른다. 현재 Google은 unrestricted standard key의 Gemini 요청을 거부한다고 명시하므로, 과거 사례만 보고 무제한 키가 현재도 반드시 Gemini 과금을 일으킨다고 단정해서도 안 된다. [Gemini 키 정책](https://ai.google.dev/gemini-api/docs/api-key)

### 현재 허용 범위와 실제 영향

실제 [키 제한 콘솔](https://console.cloud.google.com/apis/credentials/key/2f2eb5e3-340b-43d6-b577-7176bb614366?project=syu-campus)의 allowlist는 다음 25개다. 기본 생성 키라는 명칭에 의존하지 않고 선택된 항목을 읽었다.

Cloud Datastore, Cloud Firestore, Cloud Logging, Cloud SQL Admin, Cloud Storage for Firebase, FCM Registration, Firebase AI Logic, Firebase App Check, Firebase App Distribution, Firebase App Hosting, Firebase App Testers, Firebase Hosting, Firebase In-App Messaging, Firebase Installations, Firebase Management, Firebase ML, Firebase Phone Number Verification, Firebase Realtime Database Management, Firebase Remote Config, Firebase Remote Config Realtime, Firebase Rules, Firebase SQL Connect, Identity Toolkit, ML Kit, Token Service.

| 대상 | 판단 | 사용자·운영 영향과 한계 |
| --- | --- | --- |
| 키 문자열 공개 | 정상적인 클라이언트 구성 | 서버 서비스 계정 private key와 다르다. 새 키를 같은 클라이언트 구성에 배포해도 다시 공개된다. 환경변수 이동·Git 기록 제거만으로 보안 경계를 만들 수 없다. |
| Firestore 직접 읽기·쓰기 | 현재 배포 규칙으로 차단 확인 | Rules API 소스가 [firestore.rules:65](C:/Users/ssb50/Project/syu-campus/firestore.rules:65)를 포함해 저장소와 일치한다. 공개 키나 일반 ID token이 이 규칙을 우회하지 않는다. Admin SDK·자체 서버 API의 결함까지 배제하는 검증은 아니다. |
| Gemini 직접 사용 | 현재 키의 서비스 제한으로 차단 확인 | [모델 목록 읽기 API](https://ai.google.dev/api/models#method:-models.list)만 1회 호출해 403을 확인했다. 콘텐츠 생성·모델 추론·파일 조회는 하지 않았다. 이후 키 허용 범위 변경까지 보장하는 결과는 아니다. |
| Firebase AI Logic 경유 AI | 사용 설정 완료·남용 증거 없음 | 키 allowlist에는 포함되어 있지만 콘솔은 초기 설정 화면이며 앱 코드에서 사용하지 않는다. allowlist 포함만으로 추론 가능·과금을 확정하지 않는다. 향후 도입 시 별도 App Check enforcement가 필요하다. [AI Logic 보안 안내](https://firebase.google.com/docs/ai-logic/security-checklist) |
| Auth 직접 요청·메일 | 남용 방어 보완 필요 | 공개 가입과 유효한 Auth 키가 있고 App Check는 미설정이다. 직접 Firebase 요청은 사이트 학교 주소 검증·메일 플래그·메일 요청 제한/집계를 거치지 않는다. 제공자 제한 내에서 가입·메일 요청 남용 가능성이 남는다. 실제 메일 발송 실험·남용 발견은 하지 않았다. |
| 관리자 권한 | 키만으로 부여되지 않음; 별도 조건부 위험 | [admin-auth.ts:26](C:/Users/ssb50/Project/syu-campus/lib/server/admin-auth.ts:26)는 실제 ID token을 검증하고 이메일 allowlist를 확인한다. 그러나 [53](C:/Users/ssb50/Project/syu-campus/lib/server/admin-auth.ts:53)은 검증된 이메일·등록 UID를 요구하지 않는다. 허용 이메일의 미등록/선점 가능 여부에 따른 기존 조건부 위험은 별도 점검해야 한다. 운영 allowlist 계정 등록 상태는 이번에 조회하지 않았다. |
| 전체 푸시 발송 | 키만으로 발송 권한 없음 | [send/route.ts:54](C:/Users/ssb50/Project/syu-campus/app/api/notifications/send/route.ts:54)의 별도 PUSH_API_KEY 및 서버 서비스 계정 권한이 필요하다. FCM HTTP v1은 서비스 계정/OAuth 인증을 사용한다. [FCM 공식 문서](https://firebase.google.com/docs/cloud-messaging/send/v1-api) |
| Cloud SQL 등 관리 API | allowlist가 관리 권한을 부여하지 않음 | 별도 IAM 권한과 OAuth scope가 필요하다. 목록에 있다는 이유로 공개 키만으로 DB 생성·삭제가 가능하다고 해석하지 않는다. [Cloud SQL 관리 권한](https://docs.cloud.google.com/sql/docs/mysql/iam-permissions#required_permissions_for_cloud_sql_admin_api_methods) |
| 비용·기존 남용 이력 | 확정하지 못함 | Blaze이지만 메일 요청 증가가 건당 과금이라는 뜻은 아니다. 키별 요청 로그·실제 청구 내역을 확인하지 않아 피해 금액이나 남용 부재를 단정하지 않는다. Storage/Realtime Database 접근 통제도 이번 검증 결과를 확장해 보증하지 않는다. |

Auth 남용 영향은 한도를 구분해야 한다. [roommate-auth.ts:234](C:/Users/ssb50/Project/syu-campus/lib/server/roommate-auth.ts:234)의 IP·주소별 제한을 통과한 뒤 같은 공개 키로 `accounts:sendOobCode`를 호출한다. 직접 Firebase 요청은 이 함수에 들어오지 않는다. 이 경계는 기존 `docs/ROOMMATE_BOARD_PLAN.md:131`·`docs/ROOMMATE_BOARD_DEPLOYMENT.md:140`에도 명시되어 있다. 로그인 메일 한도가 소진되면 **신규 룸메이트 인증메일**에 영향이 생긴다. **관리자 로그인**은 별도의 공통 Auth/API 요청 제한이나 남용 차단이 발동할 때 영향을 받을 수 있으며, 메일 quota 소진만으로 관리자 로그인까지 중단된다고 단정하지 않는다. [공식 Auth 한도](https://firebase.google.com/docs/auth/limits)

학생 서버 세션은 [roommate-auth.ts:130](C:/Users/ssb50/Project/syu-campus/lib/server/roommate-auth.ts:130)의 검증된 학교 이메일·정확한 프로젝트·최근 인증 시각과 실제 ID token 검증이 필요하다. 외부자가 Firebase UID를 만들 수 있다는 사실만으로 학생 권한이나 서버 세션 위조가 가능해지는 것은 아니다. 위 인증·관리자·푸시·Admin 초기화 네 파일은 현재 원격 main과 동일한 Git blob임을 확인했다.

### 제한 변경·키 교체의 영향

현재 코드가 직접 사용하는 API는 Identity Toolkit, Token Service, Firebase Installations, FCM Registration 네 가지다. 나머지 허용 API는 이 프로젝트의 다른 소비 앱·운영 사용 여부를 확인한 뒤 줄일 후보이며, 전부 불필요하다고 확정하지 않는다.

| 변경 | 영향 |
| --- | --- |
| Auth API 제외·기존 키 즉시 폐기 | 관리자 신규 로그인·token refresh, 룸메이트 메일 발송·링크 완료에 장애 가능 |
| Installations/FCM Registration 제외 | 신규 알림 구독·토큰 갱신 등에 장애 가능. 서비스 계정 기반 기존 서버 푸시 발송과는 권한 경로가 다름 |
| 같은 키에 HTTP referrer 제한 즉시 적용 | [roommate-auth.ts:242](C:/Users/ssb50/Project/syu-campus/lib/server/roommate-auth.ts:242)의 서버 호출은 Referer가 없어 실패할 위험. 서버/브라우저 공유 사용을 먼저 정리하고 검증해야 함 |
| NEXT_PUBLIC 키 변경 | build-time inline이므로 재빌드·재배포 필요. 기존 열린 탭·구버전 배포·활성 SW는 기존 설정을 보유할 수 있음. 설치 Next 가이드 `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md:158,166` 확인 |
| 새 키로 로그인 저장 namespace 변경 | 설치 Auth SDK가 apiKey를 persistence namespace에 포함해 관리자 재로그인 가능성. 기존 룸메이트 HttpOnly 세션은 키 교체만으로 자동 취소되지 않음 |
| API 키만 교체 | 같은 appId·VAPID를 유지한 기존 FCM 토큰이 자동 폐기·재발급된다고 단정하지 않음. 기존 로그인 링크·캐시 클라이언트 전환은 별도 검증 필요 |

최소 후속 작업은 **미사용 API 허용 범위 정리 → 제공자 Auth 사용량·오류·quota 관찰 및 관리자 allowlist 계정 경계 확인 → 필요 시 서버/브라우저 키 사용 분리와 애플리케이션 제한 검증**이다. referrer 제한이나 키 회전만으로 직접 Auth 남용이 해결된다고 설명하지 않는다. 공개 가입 비활성화·App Check 즉시 강제·Identity Platform 업그레이드는 학생 신규 인증·비용·호환성을 바꿀 수 있으므로 이번 결과만으로 바로 적용할 처방으로 제시하지 않는다.

알림은 공개 Firebase 운영 키라는 설명과 현재 제한·Rules 근거를 남겨 처리할 수 있다. 그러나 `revoked`는 실제 키 폐기 후에만 맞으며, 테스트 전용 키도 아니다. 알림 종료는 공급자 키 폐기와 별개다. 이번에는 알림 상태를 변경하지 않았다. [GitHub 알림 처리 안내](https://docs.github.com/en/code-security/how-tos/manage-security-alerts/manage-secret-scanning-alerts/resolving-alerts)

추가 패턴 점검은 현재 추적 파일 703개 중 UTF-8 텍스트 552개를 대상으로 했다. GitHub PAT·OpenAI secret·PEM private key·AWS access key 실형식 일치를 찾지 못했고, `.env.example:102`의 서비스 계정은 placeholder였다. 이는 모든 종류의 비밀이나 전체 Git 이력의 부재를 보증하는 검사가 아니다. `.gitignore`는 `.env*`를 제외하고 `.env.example`만 허용한다. 별도 CI secret scanner나 활성 로컬 hook은 발견되지 않았지만 GitHub secret scanning·push protection은 이미 활성화되어 있다.

이번 추가 확인에서 키 인증을 사용한 호출은 공개 Auth 프로젝트 설정 GET과 Gemini 모델 메타데이터 GET 각 1회뿐이다. Google 관리 API는 기존 동일 프로젝트 서비스 계정의 OAuth로 읽었다. API Keys/App Check/Billing 관리 조회는 `SERVICE_DISABLED`, 활성 API 목록·Monitoring 집계는 403으로 제한되어 브라우저 콘솔 확인을 보완했다. App Check/AI Logic `시작하기`, API 활성화·키 생성·순환·삭제·저장 버튼은 누르지 않았다. 가입·메일 발송·콘텐츠 생성·사용자 문서 조회·키 폐기/교체·설정 변경·알림 종료·Git 이력 변경은 수행하지 않았다.

## 실행한 검증

| 검사 | 이번 결과 |
| --- | --- |
| npm run type-check | 종료 코드 0 |
| npm run lint | 종료 코드 0 |
| npm run check:unused | 종료 코드 0, Knip 미사용 항목 없음 |
| VITEST_MAX_WORKERS=2 npm run test:unit | 종료 코드 0, 100개 파일 / 630개 테스트 통과 |
| npm audit --audit-level=moderate --json --cache .cache/npm-audit | 종료 코드 0, 취약점 0개 |
| npm run check:i18n | 통과 |
| npm run check:twa | manifest/icons/Digital Asset Links 검사 통과; Android 빌드/실기기 검증은 아님 |
| npm run check:graduation | 통과 |
| npm run check:curriculum | 데이터 검사 통과; 원본 PDF 3개 부재로 해시 검사는 생략 |
| npm run check:crawl-data | 종료 코드 0, 9개 파일 dry-run 검증 |
| npm run check:python | 환경 경로 보완 후 종료 코드 0, 23개 Python 구문 및 크롤러/월간/공휴일 검사 통과 |
| 격리 소스 실행 | CSP 헤더, 중복 시간표 ID와 동시 변경, 미인증 세션 조회, 스트림 소비량, UTC 마감, 재시도 warn, 중첩 모달, 셔틀 지도 재생성, 집계 횟수 재현 |

실행 환경은 Node 24.18.0 / npm 11.16.0이다. 저장소 CI의 Node 22.13.0 / npm 10.9.4와 동일하지 않다. Python은 번들 3.12.14 + 기존 .venv site-packages(requests 2.32.5, beautifulsoup4 4.14.3)를 사용했으며 requirements의 2.34.2/4.15.0, CI Python 3.11과 동일하지 않다. 의존성 설치·업데이트는 하지 않았다.

처음 Python은 기존 .venv의 base interpreter 부재로 실행되지 않았고, 번들 interpreter 단독 실행은 bs4 부재로 실패했다. PATH를 번들 interpreter로, PYTHONPATH를 기존 .venv 라이브러리로 설정한 뒤 동일 npm run check:python을 성공 실행했다. 새 의존성은 설치하지 않았다.

npm audit 최초 네트워크 실행은 제한되었고 외부 재시도는 자동 승인에서 비공개 의존성 정보 전송 우려로 거부됐다. 로컬 npm bulk payload를 생성해 929개 이름이 모두 공개 registry 패키지이고 프로젝트 이름·local links·비공개 패키지가 포함되지 않음을 확인한 뒤 재승인받아 종료 코드 0으로 조회했다. 비밀/소스/환경변수는 감사 payload에 포함하지 않았다.

전체 npm run check 체인, production build, Python 의존성 pip-audit, Firestore emulator integration, Android Gradle 빌드, 학생 화면의 운영 브라우저/단말/사용자 DB 실행 검증은 이번에 실행하지 않았다. 따라서 기존 테스트 통과가 발견한 경계 오류의 부재나 운영 배포 정상 동작을 의미하지 않는다. S01의 별도 콘솔·키 제한·배포 규칙 확인 범위는 위에 명시했다.

## 권장 작업 순서

1. R01의 요청·응답 CSP 정합성과 한국어/영어 초기 hydration부터 고친다.
2. R02~R07의 부하/입력 경계·삭제 경쟁·ID 독립성·수집 보존·수정 토큰 보존을 작은 변경으로 고치고 재현 조건을 회귀 검사로 남긴다.
3. R08~R13의 시간대·지도·모달·날씨·env·집계 문제를 각 호출 경로 단위로 처리한다.
4. R17~R20의 삭제·기존 helper 재사용을 먼저 하고, R14~R16/R21~R24의 최적화는 실제 변경 효과와 유지보수 비용을 보고 진행한다.

새 의존성·대규모 계층 분리·운영 정책 변경 없이 처리할 수 있는 항목부터 진행한다. 이번 작업은 목록 작성까지이며 커밋·푸시·PR·배포는 수행하지 않았다.
