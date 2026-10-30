# 성능 점검 가이드

현재 코드의 경계와 재검증 방법을 유지합니다. 날짜별 실행 로그·캡처·성능 원본은 로컬에 보관하며 과거 측정을 현재 운영 상태로 승계하지 않습니다.

홈 함수는 `vercel.json`의 경로별 `functions` 설정으로 Firestore(`asia-northeast3`)와 가까운 서울(`icn1`)에서 실행합니다. 다른 경로의 리전은 기존 기본값을 사용합니다. Storage는 `US-EAST1`이므로 새 snapshot의 최초 생성에는 미국 원본 다운로드 시간이 남으며, 이후에는 버전별 공유 캐시를 사용합니다. 설치된 Next의 `preferredRegion` export는 deprecated이므로 사용하지 않습니다. 배포 후 홈의 `x-vercel-id`와 `[home-performance].region`으로 실제 적용을 확인합니다([Vercel 경로별 설정](https://vercel.com/docs/functions/configuring-functions/region#per-function-configuration)).

홈의 Firebase 공개 데이터는 활성 manifest와 immutable snapshot을 각각 Next 공유 캐시에 저장합니다. manifest key는 bucket과 `Math.floor(Date.now() / 30000)` 구간을 포함하며 구간 경계에서 바뀝니다. 이전 구간의 값을 stale-while-revalidate로 제공하거나 프로세스 TTL을 한 번 더 쌓지 않으므로 기존 최대 30초 확인 한도를 늘리지 않습니다. 해당 구간의 최초 조회는 여전히 Firestore를 읽습니다.

홈 snapshot은 같은 manifest로 계산한 공지 12개·일정·공휴일·식단·셔틀 시간표·특별 운행 결과만 저장합니다. 원문 SHA와 전체 본문의 AI source hash를 검증하며, 버전·revision·source health가 바뀌면 새 key를 사용합니다. 필수 원본 또는 metadata 실패를 빈 성공으로 저장하지 않고 기존 번들 복구 경로를 사용합니다. Pages 백엔드·목록·검색·상세·발행 도구는 기존 경로를 유지합니다. Cache Components를 전역 도입하지 않고 기존 `unstable_cache` 패턴을 사용합니다.

`[home-performance]` 로그는 홈 데이터 또는 공통 배너 조회가 1초 이상 걸리거나 실패할 때, 그리고 각 프로세스의 첫 성공한 홈 요청에 작업별 시간·성공 여부·실행 지역을 기록합니다. `manifest-cache`와 `home-snapshot-cache`의 `hit/miss`는 캐시 채우기 callback 실행 여부로 판정하며 속도만으로 추정하지 않습니다. manifest·snapshot miss도 같은 비동기 요청 범위에 포함합니다. 중첩 작업은 시간이 겹칠 수 있으므로 합산하지 않습니다. 로그에는 콘텐츠·사용자 정보·요청 URL·오류 메시지를 넣지 않습니다. 정상 빈 배너 응답은 복구 성공으로 처리하고 30초 갱신과 실제 오류 재시도는 유지합니다.

## 빌드와 분석

```bash
npm run type-check
npm run test:unit
npm run build
npm run build:analyze
```

`build`는 저장소의 기본 Next.js 빌드를 실행합니다. `build:analyze`는 `scripts/build-analyze.mjs`에서 `--webpack`과 `ANALYZE=true`를 지정하므로 기본 Turbopack 빌드와 결과가 다를 수 있습니다. 분석용 번들 크기를 기본 빌드의 실제 전송량으로 대신하지 않습니다. 변경 시 빌드 조건과 브라우저가 실제로 요청한 HTML·RSC·JS·CSS·폰트를 함께 확인합니다.

## 현재 적용된 경계

### 공통 JS와 다국어

- 페이지·기능별 코드 분할을 유지합니다. Firebase 클라이언트와 이미지 저장 등 상호작용 시 필요한 기능은 기존 지연 로딩 경로를 확인한 뒤 수정합니다.
- `lib/i18n/routing.ts`는 사전 없이 경로·로케일 함수만 제공합니다. 경로 처리 때문에 `lib/i18n.ts` 전체를 클라이언트에 값으로 import하지 않습니다.
- 공통 사전은 `lib/i18n/ko.ts`·`en.ts`로 나눕니다. `LocaleContext`는 한국어 기본 사전을 사용하고, 서버 `LocaleProvider`는 영어 요청에 영어 사전을 전달합니다. 서버의 `getDictionary`와 기존 API는 `lib/i18n.ts`에 유지합니다.
- 영어 사전의 JS 포함량 감소가 전체 전송량 감소를 뜻하지는 않습니다. 영어 경로는 직렬화된 사전이 HTML/RSC에 포함될 수 있으므로 두 언어를 각각 측정합니다. 번역과 새로고침·언어 전환 회귀 기준은 [다국어 정책](./docs/I18N_POLICY.md)을 따릅니다.
- 카테고리 이름을 구하는 공용 helper는 호출자가 받은 `dictionary.categories`를 사용합니다. 경로·이름 조회를 위해 서버의 `getDictionary`를 값으로 import하면 두 사전이 홈 클라이언트 의존성에 다시 포함될 수 있으므로 실제 빌드 그래프와 브라우저 전송량을 확인합니다.

### 홈의 메뉴와 서버 데이터

- [홈](./app/page.tsx)의 [HomeSearchBar](./app/features/home/HomeSearchBar.tsx)는 두 언어 모두 데이터 조회 경계 밖에서 SSR·hydration합니다. 대시보드는 공개 데이터 snapshot·서비스 공지·홈 배너의 3개 병렬 작업을 기다립니다. 공개 snapshot의 최초 생성은 공지·일정·공휴일·식단·셔틀·특별 운행을 병렬로 읽습니다. [HomeDashboardClient](./app/features/home/HomeDashboardClient.tsx)의 `next/dynamic`과 `Activity mode="visible"`로 대시보드 JS 로딩을 검색과 분리하며 준비된 SSR 본문을 표시합니다. 비어 있지 않은 `?search`는 검색 결과 화면의 입력을 표시하고 같은 query 처리 hook으로 언어 경로와 다른 parameter를 유지합니다.
- M3 홈에는 학식·일정·노선별 다음 셔틀과 선택한 실시간 교통 요약이 있습니다. 식당/교통 선택·실패 복구·공휴일 판정을 유지합니다. 화면·서버 작업 수와 원본 JSON 다운로드 수·시간은 다르며 이전 4조회 비교의 성능 감소율을 현재 공개 snapshot 작업에 대입하지 않습니다.
- 서버 프로세스에서 홈 데이터 조회가 한 번도 완료되지 않았으면 동기 `Home`이 `Suspense`와 스켈레톤을 바로 반환합니다. 이 경로에는 별도의 20ms 대기를 추가하지 않습니다. 3개 작업이 완료된 뒤에만 모듈의 `hasResolvedHomeData`를 설정합니다. 이 boolean은 렌더링 경로 선택용이며 데이터·버전·만료·로케일을 저장하는 캐시가 아닙니다.
- 이후 요청의 `WarmHomeContent`도 동일한 3개 작업을 시작합니다. 조회 완료와 20ms 타이머를 `Promise.race`로 비교해 데이터가 먼저 준비되면 대시보드의 `Activity` 경계를 반환하고, 타이머가 먼저 끝나면 스켈레톤과 `DeferredHomeContent`에 같은 Promise를 전달해 스트리밍합니다. 이 제한은 데이터 준비 대기이며 SSR 모듈 로드를 포함한 전체 TTFB 상한이 아닙니다.
- 큰 내부 `Suspense`는 데이터와 렌더가 완료돼도 React의 출력 크기 정책으로 본문을 숨김 segment에 보내고 나중에 표시할 수 있습니다. 설치된 React 19.3의 공개 `Activity`를 항상 `visible`로 사용해 이 표시 지연을 피하면서 선택적 hydration을 유지합니다([공식 설명](https://react.dev/reference/react/Activity#speeding-up-interactions-during-page-load)). private 렌더 설정이나 서버·브라우저별 renderer 분기는 사용하지 않습니다. 드문 대시보드 SSR 렌더·모듈 오류는 이전 내부 Suspense의 재시도 대신 기존 페이지 오류 경계에서 복구할 수 있으므로 오류 UI까지 같다고 가정하지 않습니다.
- 조회의 버전·만료·갱신 정책과 오류 전파는 유지합니다. 타이머는 `finally`에서 정리하며, 조회 오류를 성공이나 빈 데이터로 바꾸지 않습니다. 이 경로 선택이 브라우저 hydration이나 검색·메뉴 조작 준비의 단축을 보장하지는 않습니다. Sentry의 초기 오류 수집과 라우터 전환 breadcrumb도 유지합니다.
- [SearchBar](./app/components/SearchBar.tsx)는 서버 HTML 표시 후 hydration 전에 입력한 DOM 값을 초기 effect에서 state에 채택합니다. React에 이미 입력 state 갱신이 큐되어 있으면 그 값을 우선해 첫 입력을 덮어쓰지 않습니다. 초기 DOM 값이 기본값과 같으면 setState 호출 자체를 생략하며 실제 `defaultValue` prop 변경은 계속 동기화합니다. 입력 문구뿐 아니라 검색 버튼 활성화·제출 값·초기화 동작과 포커스도 함께 확인합니다.
- [검색 결과 컨테이너](./app/features/home/SearchResultsView.tsx)는 `min-h-svh`로 최소 화면 높이를 확보합니다. 로딩 중이거나 결과가 적을 때 컨테이너가 짧아지면서 하단 영역이 이동하는 현상을 줄이는 경계이며, 고정 높이로 긴 결과를 자르지 않습니다. 입력·검색 탐색 중의 layout shift와 정상 초기 로드의 CLS는 별도로 확인합니다.
- [페이지 오류 UI](./app/error.tsx)는 현재 Next.js의 `retry` prop으로 재시도합니다. 명시적인 `error.name === "ChunkLoadError"`는 사용자가 재시도 버튼을 누를 때 문서를 reload하고, 그 밖의 오류는 `retry()`를 호출합니다. 오류 발생만으로 자동 reload하지 않으며 초기 오류의 Sentry 수집을 유지합니다.
- [홈 공지 요약](./lib/server/announcements.ts)은 공지 4종을 병렬로 읽으며, 비어 있지 않은 첫 결과가 도착하면 [AI metadata](./lib/server/announcement-ai.ts)를 미리 읽습니다. 나머지 공지를 기다리는 동안 기존 60초 Promise 캐시의 진행 중 요청을 공유합니다. 전부 빈 결과이거나 `limit`이 0·0.5인 경우에는 미리 읽지 않습니다. 모든 공지를 받은 뒤 전체 원문으로 source hash를 검증하고 AI 요약을 붙인 후 본문을 240자로 제한합니다. 정상 조회의 원본 요청 수·양, 공지 수·순서, 검색·상세 원문과 만료·오류 처리는 유지합니다. 일부 공지가 나중에 실패하면 먼저 시작한 선택적 metadata 요청은 계속될 수 있으며, metadata 자체가 느리면 최종 요약 응답은 여전히 기다립니다.
- [Pages 발행 helper](./scripts/publish-crawl-data.ts)는 로컬 원본의 크기·JSON·schema 검증 후 AI metadata에만 `JSON.stringify`를 적용해 발행 bytes를 축약합니다. 로컬 원본 파일과 provider·생성 fingerprint·원본 hash 등 모든 필드는 유지하고, 발행 bytes로 manifest size/SHA-256을 계산합니다. 다른 파일과 원격 구버전 다운로드·검증·보존·rollback의 bytes는 변환하지 않습니다. 기존 pretty 버전에서 첫 축약 전환은 재발행하며, 이후 같은 key 순서에서 formatting만 다른 입력은 같은 발행 bytes로 비교합니다.
- 버전 JSON은 manifest의 raw `entry.size`가 **1MiB를 초과할 때만** Next Data Cache를 사용하지 않습니다. Next의 fetch 응답 캐시가 본문을 Base64로 직렬화하므로 원문이 2MiB보다 작아도 2MiB 캐시 항목 한도를 넘을 수 있습니다. 1MiB 이하 파일의 `force-cache`, manifest의 60초 캐시, 버전별 최대 24개 Promise 캐시·동시 요청 공유·무결성 검증·번들 fallback은 유지합니다. [Pages 런타임 캐시 정책](./docs/CRAWL_DATA_PAGES.md#앱-런타임-캐시)을 함께 확인합니다.

### 시간표 데이터와 폰트

- `TimetableBuilderClient`는 공개 `/api/lecture/timetable`을 `react-dom`의 `preload`로 요청합니다. 동일 URL·요청 속성으로 실제 query 요청이 재사용되는지 확인합니다. `fetchJson`의 `noStore: false` 예외는 이 공개 데이터 경로에 적용하며 인증·공유 API로 넓히지 않습니다.
- 정상 시간표 API 응답은 브라우저 60초, 공유 캐시 6시간, `stale-while-revalidate` 1시간을 선언합니다. 서버 프로세스 메모리 캐시와 진행 중 요청 공유도 사용합니다. 업스트림 실패 시 기존 메모리 데이터가 있으면 `stale: true`와 브라우저 0초·공유 캐시 5분을 반환합니다. CDN의 실제 캐시 적용 여부는 배포 응답으로 별도 확인합니다.
- 업스트림 요청의 20초 제한·8MiB 응답 제한·정규화 검증을 유지합니다. 메모리 캐시는 서버 인스턴스별이므로 cold start 시 원본 응답 지연은 남을 수 있습니다.
- 기본 폰트는 `app/fonts/pretendard-v1.3.9`의 자체 호스팅 variable subset이며 92개 face의 `font-display: swap`을 유지합니다. 홈 검색 분리는 폰트 파일·경로·family·범위·굵기·stylesheet 수와 Sentry 오류 수집 설정을 유지합니다. 공통 JS 의존성의 변화와 폰트 전송량은 별도로 측정합니다. `@fontsource/pretendard`나 외부 폰트 CDN을 사용하지 않습니다.
- 1023px 이하 시간표 화면에는 245자 `SYU Timetable UI` 파생 폰트를 우선 적용합니다. 목록의 다른 문자와 PC·다른 경로는 기존 Pretendard를 사용합니다. 모든 subset을 preload하지 않습니다. 문구 변경 시 [폰트 재생성·라이선스 안내](./app/fonts/syu-timetable-ui/README.md)를 따라 문자 목록과 생성물을 함께 검사합니다.

### 오류 수집과 데이터 캐시

- `instrumentation-client.ts`의 `Sentry.init`은 동기로 실행합니다. 초기 오류 수집과 라우터 전환 breadcrumb를 유지하며 초기화를 idle·첫 클릭 이후로 미루지 않습니다.
- 브라우저에서 사용하지 않는 structured logs·metrics는 `enableLogs: false`·`enableMetrics: false`로 명시합니다. 현재 client·server·edge에 성능 trace sampling 설정이나 `startSpan` 호출이 없으므로 `next.config.js`는 Turbopack의 공개 `compiler.define`으로 `__SENTRY_DEBUG__: false`·`__SENTRY_TRACING__: false`, webpack에는 대응하는 `removeDebugLogging`·`removeTracing`을 지정합니다([Sentry 공식 안내](https://github.com/getsentry/sentry-docs/blob/master/docs/platforms/javascript/common/configuration/tree-shaking.mdx)). 실제 브라우저에서 `BrowserTracing`·`WebVitals`만 제외되고 오류 핸들러·라우터 breadcrumb·스택 정규화·개인정보 제거가 유지됨을 확인했습니다. 성능 tracing을 도입할 때에는 두 빌드 경로의 tracing 제거 설정을 함께 해제해야 합니다.
- Sentry 변경 시 [초기화 테스트](./instrumentation-client.test.ts)와 [개인정보 제거 테스트](./lib/sentry-privacy.test.ts)를 실행합니다. 테스트의 가짜 전송처 수신이나 DSN 없는 빌드는 실제 운영 Sentry 수신 검증이 아닙니다.
- 앱 설치 이벤트는 같은 초기 실행 파일에서 [작은 capture 모듈](./lib/pwa-install.ts)에 보관합니다. 대시보드 hydration 전에 발생한 `beforeinstallprompt`도 카드 클릭 안에서 한 번만 사용하고, 설치 완료 시 비웁니다. 카드가 늦게 mount되는 동안 이벤트를 놓치지 않아야 하며 실제 브라우저 이벤트와 모의 이벤트 검증을 구분합니다.
- TanStack Query 캐시 정책은 기능별로 유지합니다. 갱신이 필요한 정적 `/data/*.json`, 민감 API와 서비스 워커의 `no-store` 경계를 공개 시간표 캐시와 혼동하지 않습니다. 서비스 워커는 Firebase Messaging 중심으로 유지합니다.

## 관리형 이미지 팝업

SSR의 닫힌 native dialog와 nonce bootstrap을 사용합니다. 헤더·푸터·하단 탐색 뒤의 hidden 셸 마커가 파싱되면 전체 문서 완료를 기다리지 않고 기존 검증을 거쳐 엽니다. 마커가 없으면 DOMContentLoaded 경로를 사용합니다. 이는 Suspense 본문·전체 hydration 완료 신호가 아닙니다.

저장 키·revision·KST 자정·닫기·오늘 그만 보기·Escape·Tab·배경 클릭·다른 dialog 우선·React handoff·초점 복귀를 유지합니다. 숨김/노출 예정/다른 dialog 때문에 보류된 팝업의 이미지를 미리 요청하지 않습니다. 닫힌 상태를 확인하기 전에 preload하지 않으며, DOM에서 제거하기 전에 dialog를 닫습니다.

### 로컬 이미지 비교의 범위

2026-10-30 후보의 전후 각 5회 관측이며 운영 CWV가 아닙니다. 같은 공개 데이터·62,320B WebP·warm 서버, 매회 새 Chromium context, 390×900/DPR1, CPU4배, 150ms, down 200,000B/s·up 93,750B/s, reduced-motion, 서비스워커 차단·HTTP 캐시 비활성 조건입니다. 원본 HTML을 버퍼링해 전달한 localhost HTTP/1.1 실험으로 운영 스트리밍·HTTP/2·실기기를 대신하지 않습니다.

| 중앙값 | 변경 전 | 변경 후 |
| --- | ---: | ---: |
| 팝업 열림 | 2457.3ms | 1287.6ms |
| 같은 이미지 LCP | 5204ms | 4628ms |
| 고정 0–13초 long-task blocking 보조값 | 1426ms | 702ms |

열림 범위는 1482.6–6137.1 → 1216.5–1731.7ms, 이미지 LCP 범위는 4620–7832 → 4572–4916ms였습니다. 후보 5회 모두 domInteractive 전에 열렸습니다. 보조값은 각 long task의 [start+50ms,end]와 탐색 [0,13000ms]의 겹침 합이며 Lighthouse TBT·현장 INP가 아닙니다. 5회 순차 A/B에서 p95나 일반적인 개선 보장을 추정하지 않습니다.

문서 bytes는 140,347 → 140,573B로 늘었으므로 payload 축소가 아닙니다. 별도 진단에서는 native showModal의 스타일·레이아웃 계산도 병목이었고 후보에도 남았습니다. trace의 계측 시간과 5회 비교를 합치거나 중첩된 inclusive 시간을 더하지 않습니다. CSS containment·화면 밖 푸터 지연 실험은 일관된 개선을 확인하지 못해 채택하지 않았습니다.

추가 초기 JS·폰트 비용과 공개 목록의 간헐적 fallback 분석·수정은 후속 작업으로 보류했습니다. 성공한 warm 조회를 콜드 조회 보장으로 해석하지 않습니다. 공급자 실패·빈 결과·타임아웃을 구분하고 원인을 확인하기 전에 임의의 빈 목록 캐시나 timeout 확대를 넣지 않습니다.

## 재검증 원칙

1. 동일 production build 방식·브라우저·언어·viewport·CPU/네트워크·캐시·데이터 버전/건수/해시를 고정합니다. cold와 warm, HTML 스트리밍과 버퍼링을 나눕니다.
2. 측정 중 빌드·테스트·다른 브라우저 부하를 멈춥니다. 계측 trace는 별도 실행하며 모든 회차와 중앙값·최소/최대값을 남깁니다.
3. HTML/RSC/JS/CSS/폰트 전송·파싱·실행·긴 작업을 나눕니다. 버튼 표시·handler 준비·실제 동작 완료를 혼동하지 않습니다.
4. 저장소 차단·닫기/오늘 숨김·KST 만료·초점·다른 dialog·번역/언어 왕복·기존 선택지/검색/복귀를 확인합니다. 테스트 시계를 하루 넘긴 뒤 첫 hydration을 시작하는 경우와 이미 열린 페이지의 자정 만료를 분리합니다.
5. 인증·검증·개인정보 제거·초기 오류 수집을 생략해 얻은 속도는 개선으로 인정하지 않습니다. 로컬·CI·운영·실기기 근거를 구분합니다.

## 배포 후 확인

정확한 merge SHA와 실제 배포 source marker를 연결하고 압축·캐시·폰트 요청·초기 오류 수집을 확인합니다. 실제 기기·설치 앱 재방문과 Lighthouse·현장 CWV는 별도 관측입니다. 미검증 외부/수동 경계는 [유지보수 가이드](./docs/MAINTENANCE.md), 데이터 전환은 [Firebase 실행 가이드](./docs/FIREBASE_CUTOVER.md)를 따릅니다.
