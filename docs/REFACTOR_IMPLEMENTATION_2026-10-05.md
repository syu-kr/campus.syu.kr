# 리팩터링 실행·검증 기록 — 2026-10-05

기준은 `REFACTOR_AUDIT_2026-10-05.md`의 R01~R24이다. 브랜치 `codex/refactor-audit-2026-10-05`에서 **24개 항목의 코드 수정을 완료했다**. 감사 시점 체크아웃은 `7b913add581f3d51affcf7743230cff816a882ea`였으며, 부모 작업이 PR #210으로 squash 병합된 뒤 같은 tree의 `origin/main` `539cc9bda88d678ce2008366079b982d3f6db6ae`를 기준으로 정리해 이미 병합된 변경을 PR에서 중복하지 않는다. 새로운 의존성을 추가하지 않았고 `package.json`과 lockfile은 변경하지 않았다. 사용자 승인 범위에 따라 변경을 주제별 커밋으로 기록하고 PR에서 검토하며, 앱의 운영 배포는 별도다. R13 운영 인덱스는 먼저 배포하고 준비 상태와 실제 질의를 확인했다.

## 실행 순서

1. R01의 요청·응답 CSP 정합성을 먼저 수정했다.
2. R02~R07의 입력·부하·삭제 경쟁·시간표 ID·크롤러 보존·수정 토큰 보존을 고쳤다.
3. R08~R13의 시간대·지도·모달·날씨·env·집계를 수정했다.
4. 각 담당 경로 안정화 후 R17~R20의 중복 제거·재사용과 R14~R16/R21~R24의 최적화를 진행했다.
5. 집중 회귀 검사와 전체 검증을 실행하고 실제 SDK 통합, Android 빌드, 로컬 production HTTP·브라우저 검사로 보완했다.

독립된 서버·화면·운영 경로는 병렬로 진행했다. 조건부 AI 원문 redirect는 모든 hop에 URL 검증을 적용했다. 관리자 계정 정책과 S01 키/클라우드 설정은 운영 확인 조건을 기록했다. 금·토 알림 정책은 감사에서 제외한 기존 정책을 유지했다.

## 항목별 결과

| ID | 변경 | 검증/상태 |
| --- | --- | --- |
| R01 | 동일 CSP를 Next 요청 헤더와 응답 헤더에 전달 | 한국어/영어 nonce 정합성과 실제 Next adapter 포함 proxy 19개 회귀 통과 |
| R02 | DB 세션 조회 전 기존 IP 제한 적용 | API/페이지가 사전 120회 bucket을 공유하며 121번째 요청은 DB 조회 전에 차단; 시간창 재시도 통과 |
| R03 | JSON 요청 청크 바이트 제한·취소, canonical API를 locale matcher에서 제외 | 첫 초과 청크 취소·UTF-8 경계·오류 코드 회귀 통과; 실제 HTTP에서 업로드 종료 전 413 확인 |
| R04 | 갱신된 만료 문서의 updateTime 전제조건 삭제 | 실제 Firestore SDK로 경쟁 시 전체 배치 보호, 재실행 시 여전히 만료된 문서만 삭제 확인 |
| R05 | 시간표 ID 충돌 없는 복구 | 제공 ID를 예약하고 fallback 충돌 회피; workspace/share/draft의 독립 편집 회귀 통과 |
| R06 | 재시도와 최종 실패 경고 구분 | Python 재시도 성공·최종 실패, runner의 기존 스냅샷 보존·회복 후 게시 회귀 통과 |
| R07 | 화면 메모리에 수정 토큰을 먼저 보존하고 저장소 실패 경고 | localStorage 읽기/쓰기 실패에도 서버 성공·닉네임 왕복·수정 토큰 재사용 회귀 통과 |
| R08 | 한국 시간 마감 및 연도 처리 | UTC/서울/LA, 한국 연도 경계·잘못된 날짜 회귀 통과 |
| R09 | 셔틀 지도 마커 lifecycle·선택 유지 | 시각만 바뀔 때 SDK 재생성/중심 이동 방지, 위치 갱신 후 열린 선택 유지·cleanup mock 회귀 통과. 최종 리뷰에서 X로 닫은 정보창의 재열기 회귀를 수정하고 두 선택 경로에서 refresh 시 open/panTo/setCenter/setBounds 추가 호출 0 및 재선택 후 복원을 확인 |
| R10 | DOM 최상위 모달만 키보드 처리 | 실제 문의/꿀팁 중첩 흐름 회귀와 production 브라우저 Tab·ShiftTab·Escape·입력/스크롤/포커스 복구 통과 |
| R11 | Header의 기존 React Query로 날씨 공유·5분 갱신·재시도 | 두 widget/모달 공유, TTL·오류 시 기존 값 보존·회복 회귀 통과 |
| R12 | Node util.parseEnv와 필요한 key whitelist 사용 | 한 줄/따옴표 여러 줄 JSON·CRLF·환경변수 우선순위 회귀 통과; 실제 로컬 JSON 형식은 값 출력 없이 확인 |
| R13 | 문서 다운로드 대신 AggregateField.sum(count), 인덱스 정의 추가 | 실제 Firestore emulator에서 1,002개 카운터의 합 2,004, 다른 날짜/metric 제외·빈 결과 0 확인; 운영 인덱스 READY 및 실제 sum 질의 성공 확인 |
| R14 | 기존 상태별 집계 재사용 | 필터 목록 집계 호출 12→10, 전체 목록의 native count와 legacy 결과 회귀 통과 |
| R15 | 공지 날짜 WeakMap·source identity 기반 정렬 cache | 전역 날짜 정렬/동일 날짜 tie·카테고리 우선순위·TTL·상세/요약 동작 회귀 통과 |
| R16 | 캠퍼스 지도 callback 안정화·SDK cleanup | 같은 정보창 재개방 시 닫힘 방지, listener/marker/window/frame 정리 mock 회귀 통과 |
| R17 | 무동작 catch 및 중복 API 오류 함수 제거 | TS 호출부와 Python 5개 호출부/4개 fixture 수정; 관련 회귀·Python 검사 통과 |
| R18 | 기존 cafeteria 파일의 순수 변환 공유 | 클라이언트/홈 두 입구·점심 corner·식사 형식·날짜·ID·기존 오류 정책 회귀 통과 |
| R19 | 기존 bounded 응답 reader 재사용 | Pages 크기/hash fallback, 제한 초과 취소·lock 해제·경계 회귀 통과 |
| R20 | browser fetch의 무효한 next 옵션 제거 | 세 호출부 제거; HTTP/React Query의 기존 cache·오류 동작 유지, 전체 검사 통과 |
| R21 | 서비스 공지 async 파일 읽기·metadata 재사용 | 병렬 읽기·ENOENT·경로 검증·다국어 metadata 회귀 통과 |
| R22 | 연락처/꿀팁의 기존 PaginationControls 재사용 | 한국어/영어 현재 페이지·경계·검색 초기화 회귀와 실제 브라우저 연락처 2페이지/검색 확인 |
| R23 | Android의 super 호출뿐인 override 제거 | Manifest 클래스와 Android 8 방향 처리 유지; Java 17.0.14/Gradle 8.11.1로 lintDebug/assembleDebug/bundleRelease 통과 |
| R24 | 홈 검색 signal을 세 source fetch까지 전달 | 세 source 모두 취소·AbortError 전파 회귀와 production 검색 결과 표시 확인; 부분 source 실패 정책 유지 |

## 전체 검증

| 검사 | 실제 결과 |
| --- | --- |
| `npm run check` | Node 22.13.0/npm 10.9.4에서 종료 코드 0. lint, type-check, i18n, TWA, Knip, Python, 졸업/교육과정 데이터, crawl-data, 전체 단위 검사, production build 모두 완료 |
| 위 체인의 전체 단위 검사 | **111개 파일 / 716개 테스트 통과** |
| 집중 회귀 검사 | 실제 adapter 포함 proxy 19개, 해당 ESLint와 전체 type-check 통과; 추가 알림 카드의 클릭/keyup 표시 경계·배치 회귀 13개 통과 |
| `npm run test:roommates:integration` | 로컬 Auth/Firestore emulator, 실제 SDK 통합 검사 16개 통과 |
| Android `--offline lintDebug assembleDebug bundleRelease` | Java 17.0.14/Gradle 8.11.1, 종료 코드 0, BUILD SUCCESSFUL in 30s. 80개 작업 중 7개 실행·73개 up-to-date; debug APK/release AAB 생성, lint 오류 0/경고 33 |
| 운영 Firestore 인덱스 | `CICAgNi47oMK` READY, 기존 인덱스 보존 및 실제 sum 질의 성공. 확인 시각 `2026-10-05T09:16:32.355Z` |
| 원격 필수 검사 | [PR #211](https://github.com/syu-kr/campus.syu.kr/pull/211)의 head `31de18abca105847cdaae0252093da4eeb43ff31`에서 Audit and Check, Android TWA, Analyze JavaScript and TypeScript, Dependency Review 모두 SUCCESS. 앱 코드를 바꾸지 않은 후속 문서 보완도 최신 PR 검사로 확인한다. |
| 원격 CI 환경 | [CI 실행](https://github.com/syu-kr/campus.syu.kr/actions/runs/37290786831)에서 CPython 3.11.16·requests 2.34.2·beautifulsoup4 4.15.0, pip-audit 2.10.1과 npm audit 취약점 0, 전체 111개 파일/716개 테스트·빌드 성공. Android Temurin 17.0.20-1에서 58초·80개 작업 모두 실행 및 release Digital Asset Links 검사 성공 |
| `npm audit --audit-level=moderate --json --cache .cache/npm-audit` | 종료 코드 0, 취약점 0개; package/lockfile 변경 없음 |
| production HTTP | 8 KiB 제한 경로에 9 KiB 첫 청크 입력 시 요청 종료 전에 413/REQUEST_TOO_LARGE 확인. KO cookie `/`, EN/KO cookie `/en` 모두 200·올바른 lang·실행 inline script 5개 nonce=CSP, production unsafe-eval 없음. EN cookie `/`는 307 `/en` 후 정상 응답 |
| production 브라우저 | 한국어/영어 홈 검색, 한국어 연락처 2페이지/검색, 한국어 중첩 문의 모달 Tab/ShiftTab/Escape·입력/스크롤/포커스 복구, 영어 모달/클라이언트 검증·입력 보존·한국어 전환 완료. 추가 알림 카드 수정 후 영어 Footer Contact 첫 마우스 클릭으로 카드와 문의 모달이 함께 정상 표시되고, 모달 종료 후 카드의 static 배치·Footer 앞 DOM 순서 확인. 관찰한 콘솔 error 없음 |

최신 전체 검사 증거는 `.cache/refactor-prepr-check.log`, Java 17 Android 검사는 `.cache/refactor-gradle-java17.log`, 운영 인덱스 확인은 `.cache/refactor-index-proof.json`에 있다. 앞선 검사 증거는 `.cache/refactor-validation.log`, `.cache/refactor-final-unit.log`, `.cache/refactor-final-build.log`, `.cache/refactor-integration.log`, `.cache/refactor-npm-audit.json`, `.cache/refactor-http-proof.json`에 있다. Android lint 보고서는 `twa-android/app/build/reports/lint-results-debug.html`이다. 이 로컬 로그/생성물은 Git에 포함하지 않는다.

최종 브라우저 게이트에서 **기존 loopback 영어 redirect 반복**도 발견했다. Next가 127.0.0.1을 localhost로 정규화해 외부 rewrite 후 영어 쿠키가 다시 /en redirect를 만들었다. 같은 포트의 검증된 loopback Host만 복원했고 실제 adapter 회귀로 IPv4/IPv6, 관계없는 Host/port, forwarded-host, 운영 도메인의 경계를 확인했다. 원 감사의 R01 수정에서 발생한 회귀는 아니다.

새 production 서버를 `--hostname 127.0.0.1 --port 3045`로 실행해 같은 주소의 영어 cookie redirect와 영어 hydration을 실제 확인했다. 언어 전환 후에도 검색 query가 유지됐다. 신규 알림 카드가 데스크톱 Footer의 문의 버튼을 가리는 기존 사용성 문제를 추가 수정했다. 첫 입력이 완료된 click/keyup 뒤 표시하고 Footer 앞 흐름에 배치하며, 집중 회귀 13개와 영어 Contact 첫 마우스 클릭의 실제 브라우저 동작을 확인했다. 실제 문의 전송은 하지 않았다.

최신 로컬 전체 검사는 Node 22.13.0/npm 10.9.4/Next 16.3.6, Python 3.13.14와 기존 설치 requests 2.32.5/beautifulsoup4 4.14.3으로 실행했다. Android는 JBR Java 17.0.14로 재검증했고, 원격에서 Python 3.11·requirements의 실제 버전·Temurin Java 17도 위와 같이 검증했다. 원본 PDF 3개 부재로 해당 해시 검사는 생략됐고 Node의 punycode 사용 중단 경고가 남는다. 원격 npm ci에는 jsdom/whatwg-url/undici의 선언된 Node 최소 버전보다 CI Node 22.13.0이 낮다는 EBADENGINE 경고 3개가 있어 위험 목록에 추가했다. 테스트·빌드 성공을 이 버전 조합의 공식 지원으로 해석하지 않는다. 로컬 production HTTP·브라우저 확인에는 Firebase/Kakao 등의 공개 설정을 placeholder로 지정하고 서버 서비스 계정·메일/AI/Sentry 업로드 자격을 사용하지 않았다. 실제 학생 메일·푸시, 운영 데이터 정리, 키 제한·인증 정책 변경은 실행하지 않았다.

Vercel GUI에서 `ADMIN_EMAILS`의 All Environments 등록, `FIREBASE_SERVICE_ACCOUNT`와 `FIREBASE_ADMIN_SDK_KEY`의 Production·Preview 등록은 확인했다. 사용자의 선택에 따라 운영 변수와 로컬 값의 비교는 하지 않았다. 로컬 allowlist의 1개 계정은 운영 Firebase Auth에 등록되어 있고 활성 상태지만 이메일은 미검증 상태였다. 운영 Vercel allowlist가 이 계정과 같은지는 확인하지 않았다. 계정 이메일·UID·비밀 값은 결과 문서에 기록하지 않는다.

최종 브라우저 검사에서 한국어 문의 버튼의 마우스 클릭과 모달 종료도 확인했고, Chrome 콘솔 error는 0개였다. 실제 Pages 응답에서 공지 JSON 약 2.23 MB와 AI metadata 약 6.84 MB가 Next Data Cache의 2 MB 상한을 초과해 캐시 저장 경고가 나타났다. 로딩은 계속 성공하고 기존 version별 프로세스 cache도 있으나 인스턴스 간 다운로드 비용은 남아 있어 위험 목록에 기록했다.

## 오류 가능성과 운영 조건

별도 [오류 가능성·운영 확인 목록](REFACTOR_RISKS_2026-10-05.md)에 조건부 보안 항목, 실행 환경 차이, 운영/실단말 검증 범위와 배포 전 확인 조건을 기록했다. R13 운영 인덱스 준비와 실제 sum 질의는 위 시각에 확인했다.

현재 main ruleset의 필수 검사는 `Audit and Check`, `Android TWA`, `Analyze JavaScript and TypeScript`, `Dependency Review`이며 최신 base를 요구한다. 원격 검사 결과는 이 변경의 PR에서 확인한다. 앱 배포용 저장소 동기화는 main의 CI 성공 이후에 실행되므로 PR 생성 자체가 운영 앱 배포 완료를 의미하지 않는다.
