# 배포 전 보완 반영·재검증

2026-10-26 KST. 기준 소스 `699d653569eb59d0ccdccfd9b11e41af20e6d782` 이후 M3 서비스 보완 결과다. [조사 당시 보고서](PRODUCTION_READINESS_2026-10-26.md)의 항목 ID를 유지한다. **의존성·SEO·공유·언어·목록 탐색의 소스 보완과 로컬 검증을 완료했다. 운영 배포 승인을 뜻하지 않는다.**

## 반영한 항목

| ID | 반영 | 검증 |
| --- | --- | --- |
| DEP-01 | Sentry 10.72.0→10.75.2, Vitest cohort 4.1.11→4.1.12, fast-uri 3.1.8→3.1.9, undici 8.11.2→8.12.2, zod 4.4.3→4.6.6. Sentry config import를 권장 경로로 변경 | 실제 재설치 후 npm audit 0개. Python 검사 환경 8패키지도 pip-audit에서 알려진 취약점 0개 |
| SEO-01 / REF-01 | 공통 `createPageMetadata`로 페이지별 OG·Twitter title/description/url/locale/image/siteName 구성. 영어 홈 URL, 공지 목록·서비스 공지·약관/개인정보 및 세부 화면의 홈 정보 상속 제거 | KO/EN 공개 기본 52 URL과 query/상세/비공개/404/redirect 표본을 포함한 HTTP 72검사. 공유 정보 누락·불일치 없음 |
| SEO-02 | 영어 UI와 한국어 원문의 언어 분리. 학교 공지 Article은 `ko-KR`, 원문 제목·본문·AI 값·작성자는 `lang=ko`. 번역된 빈 상태/라벨은 UI locale 유지. 서비스 공지 원문도 한국어 표시 | KO/EN 상세 HTML·JSON-LD·메타데이터 및 fallback 언어 회귀 검사 |
| SEO-03 | 공모전은 기존 서버 reader의 페이지 데이터, 꿀팁은 기존 JSON snapshot으로 SSR. 공통 순수 필터/정렬을 서버·클라이언트에서 재사용 | JS 미실행 HTML에 공모전 10개 원문 링크·꿀팁 12개 링크. 초기 중복 목록 API 요청 0 |
| SEO-04 | 공모전 source/status/search/page, 꿀팁 view/category/search/page를 URL과 연결. 기본 페이지 self-canonical, 검색/필터 변형 noindex+기본 canonical | 원래 선택지·정렬·검색·page 1 초기화 유지. 두 폭의 페이지→검색→뒤로가기, 반복 query·hash·수정키 링크 검사 |
| SEO-04 경계 | 범위 밖 번호는 마지막 유효 페이지로 redirect(0건은1). 꿀팁에서 현재 보기에 없는 종속 category는 전체로 복구. 검색 URL은 250ms trailing debounce·IME 조합 대기·popstate/unmount 취소 | 느린 이전 RSC와 최신 검색의 경합, 대기 검색 뒤로가기 취소, 합성 한글 composition 검사 |
| 폼/검색 분리 | 목록 Container의 composition capture가 Portal 제보 폼까지 받는 오류를 재현 후 실제 검색 form의 input만 처리하도록 제한 | 제보제목 조합 후 URL/메인검색 불변·초안 유지·Escape 초점·재열기, 정상 검색 조합 종료 후1요청을 두 폭에서 확인 |
| SEO-05 | KO/EN 관리자 no-store/noindex 헤더 일치. 옛 꿀팁 제안 redirect URL의 robots Disallow 제거, 현재 폼의 meta noindex 유지 | 실제 `/admin`, `/en/admin` 헤더·예전 URL308·목적지 noindex. API/admin/bot 정책 보존 |
| 검색 변경 감지 | 새 metadata·list query·filter·검색 지연/hash helper의 실제 영향 범위를 IndexNow 의존성 맵에 추가 | helper만 바뀌는 경우를 재현한 회귀 검사. private 제외·locale 안정성 유지. 실제 제출하지 않음 |
| PUB-02 일부 | 제작·감사용 JSON 3개를 `data-source/curriculum/`로 이동, 4개 생성/감사/check 소비자와 NOTICE 갱신 | 합계952,151B 원본 byte/SHA256 동일. 나머지 runtime public JSON22개 byte 불변. 옛 웹 경로404 |
| DOC-01 | 성능·유지보수의 홈7개 병렬 작업 설명, 현행 Select/모션, mixed-language 정책·FAQ 검색 기능 변경 반영. 과거 실험 기록에 시점 표시 | 문서 링크/변경 범위 검사. 이전 실패·미검증·출처 근거 보존 |

새 직접 의존성은 추가하지 않았다. Next/React/Base UI 및 기존 API·인증·실시간 공급자 설정은 변경하지 않았다. 512px 웃는 콩 이미지를 공통 OG fallback으로 재사용한다. 1200×630 신규 카드 제작은 노출 오류 수정의 선행조건이 아니므로 이번에는 추가하지 않았다.

## 기존 계약 보존

- 시간표 최대4안·초안 schema/30일 TTL·공유, 졸업요건 선택/평가/초기화, Meet 토큰/검증과 API 관련 **60파일을 기준 커밋과 byte 비교해 변경0개**를 확인했다. 시간표/졸업의 제품 화면 소스도 이번에 바꾸지 않았다.
- 공모전 상태4개·출처6개, 꿀팁 보기7개 및 종속 category 원래 목록과 조건을 유지했다. URL은 그 상태를 직접 재현할 수 있게 추가한 기능이다.
- 공모전 SSR도 기존 API와 동일하게 검색의 앞100 UTF-16 code unit을 사용한다. 전체 입력은 `initialQuery`와 URL에 남겨 복귀 시 보존한다. 마지막 API 대조에서 이 경계 차이를 보완하고 별도 회귀 검사로 고정했다.
- URL parser는 허용 값만 받고 invalid enum은 원래 기본값을 사용한다. 범위 밖 페이지·현재 보기에서 선택 불가능한 category는 서버와 클라이언트가 같은 규칙으로 복구한다. `keep=a&keep=b` 같은 반복 query와 fragment도 보존한다.
- 페이지 클릭은 history push, 검색 입력은 replace를 사용하고 `scroll:false` 및 목록 로딩 높이를 유지한다. 복사/수정키/새 탭 링크도 hydration 후 현재 fragment를 포함한다.
- 기존 전화 페이지도 쓰는 `usePagination`은 서버 초기 snapshot을 안정시키고 유효한 표시 페이지를 계산한다. 모바일 media 구독 정리·전화 검색/페이징 회귀를 포함했다.
- 실제 실패에서 빈 배열을 성공 initialData로 대신하지 않는다. 서버 snapshot을 못 읽으면 기존 client 조회/실패/재시도로 복구하며 Next의 route bailout은 다시 던진다.
- 채움실 비노출, 원문 공지 이동·인라인 AI, 날짜·날씨·식당/교통 선택, 사용자가 제거한 상위 이동·내부 갱신 문구, 기존 M3 상태·포커스·정상 격자를 유지했다.

## 검증 결과

| 검사 | 실제 실행 결과 |
| --- | --- |
| 의존성 설치 | `npm@10.9.4 ci --ignore-scripts` exit0, 실제 설치 버전 확인. 설치 후 검사/빌드 별도 실행 |
| npm audit | exit0, 알려진 취약점0. 기준 lockfile 대비 직접 패키지 추가/삭제 없음 |
| Python audit | CI와 같은 pip-audit2.10.1. requirements 감사 및 실제 검사 환경8패키지 감사0 |
| 전체 단위·회귀 | 최종 동결 소스의 **Node22.22.2·181파일·1,602테스트 통과**, 단일 worker. 313.59초 |
| lint / type-check / i18n / TWA / unused | 통과. 후속 최종 config 변경은 config 회귀 및 최적화 빌드에서도 검증 |
| Python / 졸업 / 교육과정 / crawl-data dry-run | 통과. 24 Python 스크립트, 수집9파일 dry-run. 실제 수집/발행 아님 |
| 최적화 빌드 | **Node22.22.2 / Next16.4.1 Turbopack**, TypeScript·static62/62 통과. Sentry deprecated config import 경고 해소 |
| Node22 실행 | 별도 로컬 서버의 홈·공모전·꿀팁·영어 관리자·sitemap 5응답200 |
| HTTP·사이트맵 | 72검사 완료. sitemap10,710 URL·중복0·다른origin0·private0, 5,542,488B |
| 전체 기본 화면 | **37경로 × 1440/390px = 74화면**, HTTP200·양의 가로 넘침0·pageerror0·브라우저 쓰기 요청0 |
| 목록 URL 흐름 | 2목록×2폭의 정상·범위 복구8경우 통과. 빠른3입력은 최종 검색 RSC1회, 페이지/hash/query·뒤로가기 복원 |
| 느린 응답/IME | 2목록×2폭4경우. 850ms 지연한 이전 요청과 최신 요청 모두 발생, 늦은 응답 뒤 최신 input/URL 유지. 뒤로가기 대기 검색 취소, 한글 composition 중 요청0·완성 후1회 |
| 제보 모달/IME | 1440/390px2경우. Portal 제목 조합이 목록 검색으로 섞이지 않고 초안·닫기/재열기·초점 복귀 유지. 실제 검색창의 장시간 조합은 최종1요청 |
| 번들 확인 | 초기 JS 참조 개수·사전 chunk 동일. 목록에 영어 사전 추가 없음, metadata 객체 지문0. 로컬 초기 JS 파일 gzip 합계 약24~25.5KB 감소 |
| 이동 자료 | 3파일 원본 해시·8개 tool 경로·남은 public JSON22개 byte 보존, 임시 generator 결과 JSON/LF 동일 |

37개 경로에는 비활성 룸메이트, 빈 관리자 로그인, 존재하지 않는 일정 방의 오류 화면도 포함한다. 이 74화면을 로그인·쓰기·외부 서비스 성공74개로 표현하지 않는다. 한글 IME는 Chromium에 합성 composition 이벤트를 보낸 검사이며 실제 기기/OS 입력기 검증을 대신하지 않는다.

교육과정 원본 PDF3개는 저장소에 없어 기존 hash 검사가 생략됐다. 임시 generator의 첫 raw 비교는 Windows CRLF 때문에 달랐고, JSON 및 LF 정규화 비교는 동일했다. runtime verified JSON은 재생성/변경하지 않았다.

### 중간 실패와 최종 결과 구분

- 고정 npm의 optional peer graph가 `edgesOut` 오류로 lock 재계산에 실패했다. 영향 패키지의 공식 registry metadata/integrity로 임시 lock 항목을 준비하고 정상 npm 재계산·ci를 수행했다. `--force`나 peer 검증 완화는 사용하지 않았다.
- 첫 전체 테스트는 오래 응답하지 않아 중단했다. timeout/assertion을 바꾸지 않고 명시적 `--maxWorkers=1 --reporter=verbose`로 다시 실행해 당시 Node24의1,600개 통과를 확인했다. 이후100자 경계와 Portal 회귀2개를 추가했다.
- 추가100자 경계 회귀 이후 Node22의 2worker 전체 검사에서는 선택창2건이 기존5초 제한을 초과했다(나머지1,599개 통과). 해당2파일은 같은 제한으로 분리 실행해21개 모두 통과했다. 이 병렬 실패 기록을 보존하며 최종 단일worker 전체 결과와 구분한다. 로컬 HTTP connection reuse의 ECONNRESET1회도 별도 로그로 보존하고 요청별 새 연결의72검사를 다시 통과했다.
- Portal 수정 후 Node22 단일worker 전체 검사에서는 1,601개 통과·ESLint 진단1개가 내부10초 프로세스 제한을 초과했다. 분리 Node22/24에서도 재현됐고 임시 계측에서는 설정 계산이40.427초 걸렸다. 이후 같은 계산이 약2초에 끝났고, 원본 파일의6개 테스트는 코드·제한 변경 없이 다시 통과했다. 같은 조건으로 최종 전체를 다시 실행해 위1,602개 통과를 확인했다. 시간 변동의 원인은 미확정이며 이 실패를 삭제하거나 검증 기준을 완화하지 않았다.
- 기존 analytics 테스트의 가상 hostname이 운영 hostname guard와 달랐다. 기준 HEAD도 같은 불일치임을 확인하고 테스트만 실제 hostname과 비운영 차단3경우로 수정했다. 운영 전송 guard는 그대로다.
- 초기 임시 브라우저 스크립트가 이름에 Sentry가 든 로컬 dev JS까지 차단해 hydration을 막았다. hostname 기반으로 고친 뒤 최종 optimized 검사를 수행했다. 또 SSR 검사는 카드가 `article` 태그라고 가정한 부분을 실제 원문 링크로 바로잡았다. 계측 실패를 제품 결함이나 최종 통과 결과에 섞지 않는다.
- 새 검색 지연 처리의 Container composition capture가 제보 모달 제목까지 검색어로 보내는 실제 회귀가 있었다. 회귀 테스트와 실제 최적화 브라우저에서 재현한 뒤 검색 form input으로 이벤트 범위를 제한했다. 수정 후 모달 초안·URL·초점과 정상 검색을 모두 재검증했다.

## 성능 해석

공통 metadata/query helper는 클라이언트 import 경로에 연결되지만 최종 번들에서는 사용하지 않는 metadata export가 제거됐다. 공모전·꿀팁·공지의 초기 JS에 영어 사전이 추가되지 않았고 사전 chunk의 파일명/크기도 같다. 홈에는 이전부터 두 사전이 있었으며 이를 새 회귀라고 분류하지 않는다.

홈에서 이전/최종 빌드를 각각20회 측정했다. 동일 Node24 로컬 서버, viewport390/1440, 모바일 CPU4배·150ms·1.6Mbps, load 후3초 관찰이다. 각 조건5회 전체를 사용했다. 다음은 LCP 중앙값(최소–최대), ms다.

| 조건 | 이전 | 최종 |
| --- | ---: | ---: |
| 390px 새 browser context | 1,472 (1,444–1,604) | 1,496 (1,480–2,096) |
| 390px 같은 context 재탐색 | 1,656 (1,572–2,172) | 1,608 (1,504–1,944) |
| 1440px 새 context | 188 (180–192) | 180 (172–180) |
| 1440px 같은 context 재탐색 | 220 (208–224) | 216 (208–220) |

분석/쓰기 차단용 Playwright routing은 HTTP cache를 끈다. 따라서 원시 JSON의 초기 `browser-cold`/`browser-warm` 명칭은 **cache-disabled 새 context/재탐색**으로 해석해야 하며, 진짜 HTTP cache warm 비교라고 주장하지 않는다. 원시 값을 바꾸지 않고 이 조건을 `performance-summary.json`과 본문에 보완했다. 서버는 표본 사이 유지됐고 주변 CPU 부하는 격리하지 않았다.

첫 party JS encoded body 합은 매 회 **357,933→332,420B(-25,513B, 약7.1%)**였다. 이는 JS 부분합이며 전체 네트워크·HTML/RSC·서버 비용 감소가 아니다. 최종 CLS 관찰 합의 최대는 mobile 약0.000121 / desktop0.000181, 40회 모두 pageerror·가로 넘침0이었다. raw layout-shift 합을 정식 세션 window CLS·운영 p75로 대신하지 않는다.

모바일 새 context 중앙값은 **24ms 증가**했고 최대값도 커졌다. 반복 조건은 줄었지만 표본 범위가 겹치므로 LCP가 전반적으로 개선됐다고 판정하지 않는다. JS 감소와 LCP/조작시간 개선을 동일하게 해석하지 않는다. Sentry 패치와 목록 변경이 함께 있으므로 감소 원인을 metadata 한 가지에 귀속하지 않는다. 실제 cache warm·cold function·실기기·운영 p75 검증은 남는다.

## 운영에서 남은 항목

다음은 현재 소스에 고장 난 것으로 확정한 항목이 아니라 이번에 수행하지 않은 운영 검증 또는 보류한 개선이다.

| 항목 | 남은 이유/완료 조건 |
| --- | --- |
| OPS-01 | 실제 배포 금지 요청에 따라 PR/원격CI/main/mirror/Vercel/sourceSha·운영 CDN·검색콘솔은 미검증 |
| OPS-02 | 실제 DB 쓰기·계정 권한 전환·공유/Meet 생성·메일/푸시 수신은 테스트 계정/환경의 별도 검증 필요 |
| PUB-01 | 전체 원격 Git 이력·artifact·개인정보 전수·데이터/상표 재배포 권리 확인은 미완료. 현재 패턴 검사만으로 승인하지 않음 |
| API-01 | 셔틀 원본 장애는 사용자 지시에 따라 기존 로직 유지. 로컬 Kakao domain 제한과 운영 정상 실행은 별도 |
| DATA-01 | 실제 활성 수집 주기·만나 식단 주차·학칙/원본PDF·DB index/TTL/cleanup 운영 상태를 담당자가 확인 |
| UI-01 / PERF-01 일부 | 실제 Safari/Firefox·휴대폰·보조기술·설치앱/FCM·운영 p75·cold function 비용 미검증 |
| PERF-02/03 | CSP nonce·private HTML no-store를 약화시키지 않았다. 폰트/초기 홈 높이·긴 Select는 현장/trace 근거에 맞춘 후속 최적화 대상 |
| REF-01 / UX-01 | 시간표·졸업·셔틀의 큰 컴포넌트 재작성 및 도서관 등 세로 공백의 UI 재배치는 보류. 현재 기능 계약을 바꾸는 변경을 섞지 않음 |
| PUB-02 나머지 | 구형 아이콘17개는 이전 설치·알림·외부 링크 사용 가능성이 있어 삭제하지 않음. 호환/롤백 기간 확인 후 정리 |

운영 계정/환경을 바꾸거나 실패한 셔틀 데이터를 가짜 정상값으로 대체하지 않았다. 로컬은 승인된 기존 환경을 복사·출력 없이 읽었다. source map 업로드·오류/분석 전송을 제한하고 브라우저 쓰기·외부 발송은 실행하지 않았다.

## 재현 근거

다음 파일은 개인정보·실험 산출물 정책에 따라 Git 제외 경로에 보관한다. 공개 저장소에는 이 요약과 소스/회귀 테스트를 남긴다.

- `output/release-remediation/npm-audit-after.json`, `pip-audit-after.json`, `pip-audit-installed.json`, `dependency-changes.json`
- `unit-tests.log`, `unit-tests-node22-final.log`, `unit-tests-node22-confirmed.log`, `node22-eslint-isolated*.log`, `http-after.json`, `http-check-final.log`, `inventory-after.json` 및74개 PNG
- `list-races.json`, `bundle-final.json`, `bundle-final.md`, `node22-smoke.json`, `preserved-contracts.json`
- `performance-before.json`, `performance-after.json`, `performance-summary.json`
- `output/release-readiness/release-lists-browser.json`, `tips-modal-ime-verified.json`, `curriculum-relocation*.json`

현행 설치/검사 절차는 [개발 가이드](../DEVELOPMENT.md), 출시 및 롤백 절차는 [체크리스트](RELEASE_CHECKLIST_2026-10-26.md)를 따른다. 로컬 성공을 배포·색인·실제 사용자 성능 완료로 승계하지 않는다.
