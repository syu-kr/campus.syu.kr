# 프로덕션 배포 준비 점검 — M3 서비스 구현

후속: 지적한 소스 보완·의존성 갱신·새 검증 결과는 [보완 반영 보고서](DEPLOYMENT_REMEDIATION_2026-10-26.md)를 따른다. 아래는 수정 전 조사 기록이며 당시 취약점 수/OG 누락을 현재 값으로 읽지 않는다.

기준일: **2026-10-26, 한국 시간**. 검토 소스: `699d653569eb59d0ccdccfd9b11e41af20e6d782` (`codex/m3-service-implementation`).

**판정: 배포 준비를 위한 수정·검증이 남아 있다. 현재 의존성 감사 실패를 먼저 해소하고, 공유 메타데이터·운영 환경·공개 자료 검토를 완료한 뒤 배포 후보를 확정해야 한다.** 이전 UI 검증 통과가 이 항목들의 완료를 의미하지 않는다.

이 문서는 조사와 실행 계획이다. 제품 코드·의존성·데이터·공급자 설정은 바꾸지 않았으며, 파일 삭제·Git 이력 정리·푸시·병합·배포·운영 쓰기는 하지 않았다. 전체 보안 감사나 침투 테스트 보고서도 아니다.

함께 사용할 문서:

- [공개 저장소 파일·정보 정리 목록](PUBLIC_REPOSITORY_CLEANUP_2026-10-26.md)
- [배포 실행·검증·롤백 체크리스트](RELEASE_CHECKLIST_2026-10-26.md)
- 기존 상세 가이드: [환경](ENVIRONMENT_REGISTRATION.md), [검색](SEARCH_INDEXING_GUIDE.md), [Firestore](FIRESTORE_RULES.md), [수집·롤백](CRAWL_DATA_PAGES.md), [M3 구현 기록](M3_SERVICE_IMPLEMENTATION_2026-10-26.md), [후속 변경 기록](M3_UI_STATUS_FOLLOWUP_2026-10-26.md)

## 1. 이번에 확인한 범위와 증거의 한계

| 구분 | 이번 확인 | 해석 |
| --- | --- | --- |
| 소스 | 추적 파일 864개 목록, 설정·공통 UI·SEO·주요 API·운영 워크플로와 공개 자산 사용처 | 모든 함수의 보안·정합성을 감사한 것은 아님 |
| 실행 서비스 | 기존 로컬 최적화 빌드의 읽기 전용 HTTP 검사 67 URL | 공개 기본 경로 26개 × KO/EN 52개 + 검색/페이지/상세/비공개/404 표본 15개. 전체 37페이지 상호작용 재검사는 아님 |
| 응답 | HTTP 200 66개, 의도한 없는 경로 404 1개 | 관리자 로그인·비활성 룸메이트·없는 일정 방의 200은 작업 성공이 아님 |
| 메타데이터 | `facebookexternalhit/1.1` UA, 응답 HTML을 JS 미실행으로 파싱 | 실제 Kakao/X 카드 캐시나 운영 CDN 응답 검증이 아님 |
| 사이트맵 | 로컬 `/sitemap.xml` 전체 XML 파싱 | XML의 10,710개 URL 모두를 HTTP 방문하지는 않음 |
| 의존성 | 현재 lockfile의 `npm audit --json --ignore-scripts`, `npm ls` | 알려진 패키지 권고 및 CI 차단 근거. 서비스에서 공격 경로가 재현됐다는 뜻은 아님 |
| 비밀정보 | 현재 추적 텍스트의 고신뢰 키 패턴, 일부 민감 파일명의 로컬 Git 이력 | 전체 Git 객체·모든 원격 branch/tag·PR·Actions artifact 검사는 아님 |
| 성능 | 현재 빌드 CSS 크기, 기존 측정의 조건·미해결 항목 재검토 | 새 Lighthouse/PSI·실사용 p75·실기기 INP 측정은 하지 않음 |

임시 계측 코드는 앱에서 호출하지 않는다. 비공개 로컬 근거는 Git 제외 경로 `output/release-readiness/http-evidence.json`, `npm-audit.json`, `repository-inventory.json`이다. 스크립트·환경값·원본 HTML·개인 브라우저 상태를 이 보고서에 복사하지 않았다. HTML의 스트리밍 조각은 최초 `main` 바깥에 있을 수 있으므로 단순 `main.textContent` 길이로 SSR 콘텐츠 부재를 판정하지 않았다.

### 기존 검증과 구분

초기 M3 구현 기록에는 37개 경로 × 2개 폭의 74화면, 1,452개 단위 테스트와 전체 `npm run check` 통과가 있다. 이후 변경은 각 기록의 관련 검사 범위로 검증됐다. 가장 최근 UI 변경은 관련 47테스트·타입·린트·최적화 빌드와 영향 화면 검증이다. **이전 전체 검사가 현재 HEAD 전체 검사를 대신하지 않으며, 이번 npm audit 실패도 그 이후에 확인한 별도 사실이다.**

## 2. 우선순위와 완료 기준

`P0`는 배포/공개 승인 전에 닫아야 할 게이트, `P1`은 이번 출시 전에 보완 권장, `P2`는 후속 개선이다. 이는 작업 우선순위이며 보안 취약점 심각도와 다르다. 환경 미검증 항목은 결함 확정으로 표시하지 않는다.

| ID | 순위·상태 | 대상 / 문제 | 필요한 조치와 완료 기준 | 담당 역할 |
| --- | --- | --- | --- | --- |
| DEP-01 | P0 · 확인 | 의존성 감사 6패키지 실패. 현재 CI의 moderate 이상 차단 기준을 넘음 | 호환 패치로 lock 갱신 → 감사 0 또는 명시적 검토 절차 → 새 정확한 SHA의 CI·빌드 성공. 감사 기준을 낮춰 통과시키지 않음 | 개발 |
| OPS-01 | P0 · 미검증 | 새 구현의 Production 환경·실제 배포 SHA 없음 | 환경별 설정 확인, 후보 SHA → main → mirror SHA → Vercel 배포 → `sourceSha` → 실제 응답 연결 | 운영/개발 |
| OPS-02 | P0 · 미검증 | 문의·제안 저장, 공유·일정 쓰기, 관리자 실제 권한, 메일·푸시 수신 | 별도 테스트 환경/테스트 계정의 합성 데이터로 필요한 성공·실패·복귀를 검증. 기능을 켜고 출시하는 경우에만 해당 성공 게이트 적용 | 운영/QA |
| PUB-01 | P0 · 미검증 | 전체 이력의 비밀값/개인정보와 데이터 재배포 근거 | 전체 이력·artifact 점검, 발견 비밀 폐기, 공개 데이터·자산별 권리 및 개인정보 검토. 현재 패턴 무검출만으로 승인하지 않음 | 저장소 관리자 |
| SEO-01 | P1 · 확인 | 다수 페이지 OG 이미지 누락·홈 정보 상속 | 공통 metadata 구성의 누락 수정, KO/EN 목록·상세·메뉴의 title/description/image/url 일치 검사 | 개발 |
| SEO-02 | P1 · 확인 | EN 공지의 한국어 본문에 Article `inLanguage: en` | UI 언어와 실제 문서 언어 분리. 원문 구역 lang 및 schema 언어 수정. hreflang/canonical 정책을 실제 번역 범위에 맞게 결정 | 개발/콘텐츠 |
| SEO-03 | P1 · 확인 | 공모전·꿀팁 첫 HTML에 콘텐츠 목록이 없음 | 공개 첫 목록을 서버에서 준비하고 동일 initialData로 hydration. 필터·검색·페이지 계약 유지 | 개발 |
| SEO-04 | P1 · 정책/후속 구현 | 공모전·꿀팁 필터/페이지는 컴포넌트 상태, 직접 URL 재현 불가 | URL 지원을 추가한다면 기존 선택지 그대로 server query·링크·canonical·검색 noindex까지 함께 구현. 현재의 URL 미지원과 canonical 오류를 혼동하지 않음 | 개발/제품 |
| SEO-05 | P1 · 확인 | robots의 꿀팁 제안 예전 경로, EN 관리자 응답 헤더 차이 | noindex·robots·header 정책 표를 통일. 제안 새 경로는 현재 meta noindex가 정상이며 이를 가리는 무조건 Disallow 추가는 피함 | 개발 |
| PERF-01 | P1 · 미검증 | 최종 M3 HEAD의 운영/저사양 기기 성능 기준 없음 | 모바일/데스크톱 cold/warm 반복 계측, 주요 조작 및 기존 설치 상태 측정. p75는 실제 표본으로 별도 확인 | 개발/QA |
| PERF-02 | P1 · 개선 후보 | 루트 요청별 headers/nonce로 페이지 HTML이 동적·no-store | 데이터 캐시·cold cost·TTFB부터 측정. CSP나 개인 화면 no-store를 제거하지 않고 공개 데이터 경계를 개선 | 개발 |
| PERF-03 | P1 · 개선 후보 | 폰트/공통 JS, 초기 홈 높이 변화, 긴 Select | 현행 trace로 원인 확인 후 필요한 부분만 줄임. 목록 높이 보존·포커스·한글 글리프 유지 | 개발 |
| API-01 | P1 · 알려진 외부 제한 | 셔틀 위치 원본 오류, Kakao 로컬 도메인 제한 | 기존 셔틀 로직 유지. 운영 도메인에서 지도·원본 성공을 별도 확인하고 장애 시 정적 시간표/안내 제공 | 운영 |
| DATA-01 | P1 · 미검증 | 크롤링·식단·졸업규정·TTL의 운영 최신성 | 활성 Pages 버전·수집 시각·학기/연도·원본 요람·만료 정리 확인. 유효한 정상본 유지 | 운영/콘텐츠 |
| DOC-01 | P1 · 확인 | 운영 가이드가 M3 전/중간 상태를 일부 설명 | 아래 문서 정리 목록에 따라 현행 안내와 과거 실험 기록 분리 | 개발 |
| UI-01 | P1 · 미검증 | Safari/Firefox·실기기·보조기술 | native Select fallback, modal keyboard, 320/390/768/900/1440/1920px, 확대·reduced motion·터치 검사 | QA |
| REF-01 | P2 · 확인 | 거대 컴포넌트와 구조 의존 CSS | metadata 공통화 우선. 이후 기능별 작은 변경, 상태/저장소 스키마 불변 회귀 검사 | 개발 |
| PUB-02 | P2 · 후보 | 참조 없는 구형 이미지 17개 | 외부/구버전 앱 소비자·롤백 기간 확인 뒤 정리. 첫 화면 전송 절감으로 과장하지 않음 | 개발/운영 |
| UX-01 | P2 · 기존 관찰 | 도서관 행 공유로 큰 세로 공백 등 | 별도 디자인 수정 승인 범위에서 개선. 이번 문서 작업에서 여백은 바꾸지 않음 | 디자인/개발 |

## 3. 성능·안정성·비용

### 유지할 구현

- 서버 공지 목록·상세, 홈 서버 데이터, React Query 캐시·취소·실패 상태가 이미 있다.
- 검색과 대시보드의 hydration 경계를 분리하고, 검색/날씨 대화상자 및 `html-to-image`, Firebase messaging 초기화를 필요 시점으로 미루는 구현이 있다.
- 신규 Motion 패키지 없이 CSS와 공통 선택 표시를 사용한다. `prefers-reduced-motion` 처리를 유지한다.
- 공지/공모전 페이지 전환 중 이전 목록 높이를 보존하여 스크롤 튐을 줄였다. 리팩터링으로 이 처리를 제거하지 않는다.
- 이미지 AVIF/WebP, 본문 외부 폰트 요청을 피하는 로컬 폰트, 버전이 붙은 새 콩 아이콘 URL을 유지한다.

### 현재 수치가 뜻하는 것

| 근거 | 수치 / 조건 | 사용 가능한 판단 |
| --- | --- | --- |
| 현재 `.next/static/chunks` | 가장 큰 공통 CSS 192,831B, 로컬 gzip 계산 30,523B | 전역 CSS 정리의 기준값. CDN 실제 전송/페이지 전체 CSS 합은 아님 |
| 추적 폰트 | 98파일 3,093,688B. 전체 glyph 파일·CSS·권리 문서 포함 | 모든 파일을 첫 방문에 받는다는 뜻이 아님. 실제 사용 subset 요청을 측정해야 함 |
| 직전 Select 검증 | 527옵션 첫 desktop 열림 239ms, 반복 131.5–151.1ms | 무제한 CPU 로컬 pointerdown→DOM+다음 frame. 정식 INP나 모바일 기기 결과 아님 |
| 이전 M3 초기 측정 | 390px·CPU 4배·150ms/1.6Mbps, LCP 1.51–1.92초 | 당시 환경값 없는 빌드의 참고. 현재 실데이터·운영 성능으로 승계 금지 |
| 이전 실제 홈 관찰 | 초기 비동기 데이터로 푸터 위치 178px 변화 | CLS 원인 확인 후보. 178px를 CLS 점수로 바꾸어 표현하면 안 됨 |

현재 루트 [layout](../app/layout.tsx)의 `headers()`와 [proxy](../proxy.ts)의 요청별 nonce가 있다. 이번 52개 공개 기본 URL의 HTML은 로컬에서 `private, no-cache, no-store...`였다. `app/page.tsx`의 `revalidate=300`만 보고 전체 HTML이 5분간 CDN 캐시된다고 판단하면 안 된다. 데이터 캐시와 Full Route/HTML 캐시는 다른 층이다. **공개 HTML cache 변경은 nonce·쿠키/언어·사용자별 정보가 섞이지 않는 설계 검증이 선행돼야 한다.**

홈은 현재 7개 병렬 데이터 작업을 기다린다. `PERFORMANCE.md`와 `MAINTENANCE.md`의 일부 4개 조회 설명은 현행과 다르다. 느린 소스가 홈 콘텐츠 완성을 붙잡는지 cold/warm으로 측정하고, 필요한 경우 요약 카드별 서버 경계를 나눈다. 전체 CSR 전환이나 무조건 폴링 확대는 하지 않는다.

### 출시 성능 기준과 측정 방법

1. 테스트 SHA·빌드 방식·데이터 버전·Node·기기·네트워크·CPU·캐시·서비스워커 조건을 고정한다. KO/EN 홈, 공지, 학식, 버스, 도서관, 시간표, 졸업요건, 지도, 검색을 대표군으로 잡는다.
2. 최초 방문과 재방문을 나누어 최소 5회씩 기록한다. 중앙값과 범위를 함께 남기며 느린 회차를 버리지 않는다. 운영과 동일한 번들로 제한된 성능 검증 환경에서 측정한다.
3. 실제 사용자 목표는 모바일/데스크톱 각각 **p75 LCP ≤2.5초, INP ≤200ms, CLS ≤0.1**이다. Lighthouse의 TBT나 임의 long-task 합계로 INP 통과를 대신하지 않는다. [Web Vitals 공식 기준](https://web.dev/articles/vitals)
4. 검색 입력 직후 메뉴 표시·Enter 제출, 527개 페이지 Select, 시간표 1,526강의 검색/추가/4안 비교/이미지 저장, 졸업 선택, 지도 초기화, 모바일 하단 메뉴를 조작한다. 네트워크와 render 지연을 분리한다.
5. JS/CSS/폰트의 encoded/decoded bytes, 중복 요청, long tasks, LCP 요소, layout shift 원인, 서버 TTFB·cold cost를 남긴다. 초기 목표는 기준 대비 설명 없는 10% 초과 증가를 검토 대상으로 삼는 것; 이 값은 프로젝트의 제안 예산이며 표준 의무값이 아니다.
6. 실제 RUM은 `useReportWebVitals` 같은 기존 플랫폼 수단을 검토하되 raw 검색어·방 ID·토큰·연락처를 전송하지 않는다. 현재 소스에는 별도 Web Vitals 수집이 없고 Sentry는 로그/metrics를 끈 오류 수집 위주다. 호스팅 콘솔의 별도 분석 기능 활성화 여부는 미확인이다.

### 우선 검토할 비용

- 폰트 92개 subset 자체를 삭제하지 않는다. 새 문구·강의명에서 fallback이 필요하다. 첫 화면에 필요한 subset과 중복 레이아웃 비용만 확인한다.
- 공통 Base UI/Sentry/React 평가 비용은 번들 분석과 실제 trace를 연결한다. 설치된 `build:analyze`는 `--webpack`을 사용하므로 기본 Turbopack 운영 번들과 바이트 비교를 혼용하지 않는다.
- [globals.css](../app/globals.css)가 모든 M3 페이지 CSS를 가져온다. 먼저 실제 중복 규칙을 줄이고, 페이지별 분할은 cascade·전환 시 FOUC·인쇄 검증을 통과할 때만 적용한다.
- 일일 공지 JSON과 AI metadata는 원격 캐시·프로세스 메모리를 사용한다. 큰 JSON cold 다운로드/파싱, 인스턴스 증가, API 호출량·Vercel 함수 시간·Firestore reads/writes·OpenAI 수집 비용을 함께 본다.
- `public/data/`의 11.54MB는 정적 자산 총량이다. 전부 홈에서 다운로드하는 것으로 해석하지 않는다. 운영용 fallback과 감사용 데이터는 구분한다.
- polling은 실제 선택한 실시간 교통·좌석 등 필요한 화면에서만 유지하고, 비활성 탭/백그라운드/오류 재시도 폭주와 제공자 제한을 확인한다. 정적 학식에 정상 새로고침이나 사용자용 내부 갱신 문구를 다시 추가하지 않는다.

## 4. SEO·GEO와 검색 노출

### 이미 있는 기반

`metadataBase`, KO/EN canonical·hreflang·x-default, sitemap, robots, JSON-LD, 공지 서버 목록·상세, 별칭 308, 일반 없는 경로 404, 검색 noindex, Naver/Bing 환경 기반 소유확인, IndexNow 발행 흐름이 있다. 새 SEO 패키지나 검색엔진별 중복 레이어를 도입하기보다 이 계약을 보완한다.

### 확인된 메타데이터 문제

**SEO-01 — OG/X 정보가 페이지와 다름.** 67개 검사 URL 중 HTTP 200 66개에서 `og:image` 없는 응답이 44개다. 이 수에는 KO/EN·query 변형·비공개 표본이 포함되며 “44개의 서로 다른 공개 페이지”라는 뜻은 아니다. OG title과 Twitter title이 서로 다른 응답은 43개다. 둘이 같은 경우에도 둘 다 홈 제목인 오류가 있으므로 이 수가 전체 오류 수는 아니다.

| 페이지 유형 | 실제 HTML 관찰 | 원인/최소 보완 |
| --- | --- | --- |
| 시간표·졸업·학사 메뉴·공모전·일정·장학, 캠퍼스 메뉴·버스·학식·도서관·지도·전화·꿀팁·체육·건강, 더보기·Meet·알림 설정 | 페이지별 OG title/url은 있으나 image가 없고 Twitter title은 홈 제목 | 자식 `openGraph`가 부모 객체를 덮어씀. 공통 이미지·locale·siteName을 합성하고 Twitter도 같은 페이지 정보로 구성 |
| 전체/학사/SW/캠퍼스 공지 목록, 서비스 공지 목록·상세, 약관·개인정보 | `<title>`은 해당 페이지지만 OG title/url이 홈으로 남음 | 페이지별 metadata에서 social 필드까지 함께 구성 |
| 영어 홈 | canonical `/en`, OG URL은 루트 `/` | 실제 locale URL과 일치시키기 |
| 학교 공지 상세 KO/EN | 상세 title/url은 있으나 OG image 없음, Twitter 홈 제목 | 공통 이미지 fallback + 기사별 title/description/url 유지 |
| 개인 방·관리·룸메이트 | noindex 상태, 일반/상위 화면 social 정보 | 개인 내용·방 ID·토큰을 OG로 넣지 않음. 공유 정책에 맞는 비민감 기본 카드만 제공 |

Next metadata의 중첩 객체는 얕게 병합되므로 자식 `openGraph`가 부모 image를 자동 보존한다고 가정할 수 없다. 작은 공통 metadata 함수 또는 공통 image 필드를 사용하고, 기존 canonical/search/noindex 정책은 별도로 보존한다. [Next 공식 병합 규칙](https://nextjs.org/docs/app/api-reference/functions/generate-metadata#merging)

**SEO-02 — 실제 콘텐츠 언어.** EN 공지 상세 표본은 한국어 headline·본문/AI 요약을 사용하지만 Article schema의 `inLanguage`는 `en`이다. UI locale을 그대로 전달하는 [상세 구현](../app/announcements/[category]/[id]/page.tsx)이 원인이다. 영어 메뉴를 유지하면서 한국어 원문 구역에 `lang="ko"`를 부여하고 Article 언어를 실제 원문으로 지정한다. EN URL을 삭제하거나 자동 번역 대량 생성부터 할 필요는 없다. 번역되지 않은 본문을 제공하는 페이지의 hreflang·canonical·sitemap 정책은 실제 번역 범위를 문서화한 후 일괄 조정한다. 반환 링크를 양방향으로 유지한다. [Google 다국어 문서](https://developers.google.com/search/docs/specialty/international/localized-versions)

**SEO-03/04 — 공개 목록의 HTML·URL.** 공모전과 꿀팁은 `useQuery`로 목록을 가져오며 초기 data를 받지 않는다. 해당 기본 HTML에서 페이지 제목·안내는 있지만 목록 링크는 없다. 검색엔진의 JS 실행에 의존하는 부분이다. 공모전은 `useState`로 검색/출처/상태/페이지를 관리하며 `PaginationControls`에 `getPageHref`도 넘기지 않는다. 임의로 `?page=2`나 `?search=test`를 붙여도 해당 상태를 읽지 않고 기본 canonical을 제공한다. 따라서 이를 “이미 동작하는 2페이지의 canonical이 잘못됐다”로 판정하지 않는다.

우선 공개 첫 목록을 SSR+initialData로 제공한다. URL 재현을 지원하기로 하면 서버 query와 클라이언트 초기값, 새로고침/뒤로가기, 페이지 `<a href>`, 페이지별 self-canonical, 검색 noindex를 하나의 작업으로 묶는다. 상태/출처 옵션·검색 조건·page 1 초기화·로딩 높이 계약을 유지한다. 실제 여러 페이지 URL을 제공하는 경우 첫 페이지로 canonical을 몰지 않는다. [Google 페이지네이션 지침](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading)

### 색인 정책 표

| 대상 | 현재/권장 |
| --- | --- |
| 공개 메뉴·정보·법적 고지·서비스 공지·공개 학교 공지 | index, 실제 페이지 canonical, KO/EN 양방향 alternate |
| 공지 `?page=2` 등 | 현재 self-canonical 정상. SSR 목록과 링크 유지 |
| 홈 `?search=`·공지 검색 | 현재 `noindex, follow`, 기본 경로 canonical 정상 |
| 공모전/꿀팁의 현재 상태 기반 필터 | canonical 기본 경로. 존재하지 않는 URL 계약을 문서에 약속하지 않음 |
| `/campus/campus-tips/suggest` | 현재 meta `noindex, follow`, sitemap 제외. robots에는 옛 `/more/.../suggest`만 있어 설명/정책 정리 필요 |
| 관리자·룸메이트·개인 일정 방 | noindex 유지. noindex/robots는 접근 제어가 아니므로 서버 인증을 유지 |
| `/en/admin` | meta noindex 정상, `/admin`과 달리 X-Robots-Tag 헤더 없음. 헤더 정책 일치 여부 점검. 현 상태를 색인 노출/인증 우회로 단정하지 않음 |
| 시간표 공유 query/개인 상태가 있는 링크 | 공유 기능의 비공개성 기준을 먼저 정하고 canonical·noindex·분석 제외를 별도 점검. 이번 HTTP 표본에 유효한 공유 링크는 없음 |
| Preview 도메인 | 플랫폼 Deployment Protection 및 noindex 확인. production canonical만으로 Preview 색인 차단을 보장하지 않음 |

robots에 경로를 막으면 crawler가 meta noindex를 읽지 못할 수 있다. 불필요한 Disallow 추가를 배포 체크의 대체 수단으로 쓰지 않는다. 현재 robots에서 OAI-SearchBot/GPTBot은 별도 차단 없이 `*` 정책을 따른다. 검색과 학습 허용은 서로 다른 정책 결정이다. [OpenAI 공식 crawler 구분](https://developers.openai.com/api/docs/bots)

### GEO의 실질적 작업

- 학교 공식 서비스로 오인되지 않는 publisher·비공식 서비스 고지, 원문 링크, 적용 학기/연도, 정확한 제목과 요약을 유지한다.
- 공지/학식/셔틀/졸업요건에서 사용자가 읽는 본문과 JSON-LD의 사실을 일치시킨다. AI 요약이 원문을 대체하거나 오래된 요약의 날짜를 새 게시일처럼 표시하지 않게 한다.
- 불필요한 “정보 갱신됨”·내부 수집 로그를 UI에 되살리지 않는다. 학식 적용 날짜, 셔틀 업데이트 날짜, 공지 게시일처럼 판단에 필요한 시점만 표시한다. 세부 수집 상태는 운영 진단에서 확인한다.
- 학식·버스의 메뉴/시간을 이미지나 지도만으로 제공하지 않고 텍스트 대체를 유지한다. 개인 데이터·공유 토큰은 검색용 설명에 넣지 않는다.
- 원문 복제의 양보다 일정·식단·검색 조건을 이해하기 쉬운 구조와 출처의 정확성을 우선한다. 영어 단어 수나 임의의 “AI 인용 점수”를 출시 기준으로 사용하지 않는다.
- `llms.txt`, GEO 전용 schema, AI가 읽는 숨겨진 문구·대량 FAQ를 필수 산출물로 만들지 않는다. Google은 기존 검색 품질·기술 원칙을 강조하며 특수 AI 파일을 요구하지 않는다. [Google의 현행 생성형 검색 가이드](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- 졸업요건·전화 페이지에 FAQPage가 있지만 Google은 **2026-05-07부터 FAQ 리치 결과를 중단**했다. 유용한 실제 Q&A는 유지하되 검색 확장 노출을 보장하는 항목으로 세지 않는다. 현재 [공식 변경 기록](https://developers.google.com/search/updates)에 맞춰 기존 문서도 수정한다.

## 5. 사이트맵·검색 콘솔·IndexNow

현재 [sitemap](../app/sitemap.ts)은 공개 경로 26개와 서비스 공지, 4개 학교 공지 category를 KO/EN으로 생성한다. 전체 XML 검사 결과:

| 항목 | 결과 |
| --- | --- |
| 상태/크기 | 200, 비압축 UTF-8 5,542,488B |
| URL | 10,710개, unique 10,710개 |
| origin | 모두 `https://campus.syu.kr` |
| 비공개 경로 | admin/api/roommates/suggest/개인 Meet 방 매칭 0개 |
| alternate | 32,130개, 각 URL에 KO/EN/x-default |
| lastmod | 서비스 공지 38개 항목에 존재. 모든 항목에 현재 시각을 일괄 삽입하지 않음 |

현재 단일 sitemap은 50,000 URL / 비압축 50MB 제한 이내다. 당장 크기 때문에 분할할 필요는 없다. 항목/용량 증가와 응답 비용을 감시하고 한계에 접근하기 전에 index+분할을 도입한다. `priority`/`changefreq` 값 조정으로 색인 보장을 기대하지 않는다. [Google sitemap 규칙](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)

배포 후보에서 검사할 내용:

1. XML 전체 parse·unique·origin·private 제외·alternate reciprocity·유효 날짜. 마지막 성공 sitemap과 급격한 URL 수 감소를 비교한다.
2. 공개 기본 경로와 공지 category별 최신·오래된 표본의 HTTP/canonical/noindex를 확인한다. 10,710개를 짧은 시간에 실서비스에 전수 요청하지 않는다.
3. `PUBLIC_ROUTES`와 실제 nav/이동 경로의 차이를 검토한다. 공모전·외부 링크의 항목 자체를 무조건 내부 상세 URL로 생성하지 않는다.
4. Naver/Bing verification은 Production의 초기 head에만 올바른 비공백 값이 있는지 확인한다. Google 검증 meta는 현재 서로 다른 두 값이 있어 각 소유자가 필요한지 확인하고, 단순 중복이라는 이유로 소유권을 제거하지 않는다.
5. GSC·네이버·Bing의 sitemap 처리 결과와 URL 검사에서 사용자 선언 canonical/검색엔진 선택 canonical을 구분한다. 제출 완료와 색인 완료는 다르다.
6. IndexNow는 기존 [정확한 SHA·데이터 버전 확인 흐름](SEARCH_INDEXING_GUIDE.md)을 유지한다. 배포되지 않은 브랜치의 URL/내용을 먼저 제출하지 않는다. HTTP 200/accepted는 수신이며 색인·AI 인용 증거가 아니다.

## 6. OG·공유·브랜딩

먼저 4절의 **누락/홈 정보 상속**을 수정한다. 앱 아이콘 512×512 자체가 잘못된 OG 규격은 아니지만 글과 페이지 종류를 전달하는 카드가 없어 공유 시 설명력이 약하다.

- 공통 fallback은 승인된 A 콩 로고·서비스명·짧은 설명을 쓰는 **1200×630 제작안**을 권장한다. 이는 프로젝트 디자인 선택이며 모든 플랫폼의 의무 해상도가 아니다. 현재 512 아이콘을 사용한 `summary` 카드도 유효할 수 있다.
- 초기 출시는 고정 이미지 하나와 페이지별 정확한 title/description/url이면 충분하다. 매 요청 동적 이미지 생성·AI 이미지 생성·페이지 수만큼 파일 복제를 먼저 도입하지 않는다.
- 공지 상세는 원문 제목·실제 게시일/분류를 사용한다. description 길이 제한은 한국어 잘림·문맥으로 판단하고, 표준화되지 않은 고정 글자 수를 SEO 통과 기준으로 삼지 않는다.
- OG의 image URL·size·alt·type·locale·siteName, Twitter card/title/description/image, favicon/apple/manifest를 함께 검사한다. 네 필수 OG 속성은 title/type/image/url이다. [Open Graph 규약](https://ogp.me/)
- 공개 URL과 이미지는 인증 없이 200·적절한 Content-Type이어야 한다. KakaoTalk·X·메신저 실제 미리보기는 배포 후 cache refresh까지 별도 확인한다. 이번 UA 검사로 앱의 미리보기 캐시 갱신을 증명하지 않는다.
- 구형 알림/PWA/Android는 오래된 이미지 URL을 기억할 수 있다. 기존 아이콘은 호환·롤백 기간을 확인한 뒤 정리한다. 서명된 Android 릴리스와 웹 배포는 별도다.

## 7. 의존성·보안·개인정보 준비

### DEP-01: 현재 감사 실패

`npm audit --json --ignore-scripts`는 **exit 1**, 패키지 집계 critical 1 / high 2 / moderate 3이다. 이는 6개의 독립적인 운영 공격 경로를 뜻하지 않으며 하나의 권고가 전이 의존성 여러 패키지에 집계될 수도 있다.

| 패키지 / 설치 버전 | npm 집계 | 확인한 의존 경로·대응 |
| --- | --- | --- |
| `@sentry/nextjs` 10.72.0 | critical | 직접 의존성. advisory 수정판 10.75.2 이상 중 호환 패치 검토 |
| `vitest` / `@vitest/mocker` 4.1.11 | 각각 moderate | 개발/테스트 경로. mocker 권고 수정판 4.1.12 이상에서 함께 검증 |
| `undici` 8.11.2 | high | 현재 설치 트리는 jsdom 개발 의존 경로. 수정판 8.12.2 이상을 포함하는 호환 조합 검토. Node 내장 fetch 버전과 동일한 것으로 취급하지 않음 |
| `fast-uri` 3.1.8 | moderate | Sentry webpack plugin → schema-utils/ajv 경로. 수정판 3.1.9 이상 검토 |
| `zod` 4.4.3 | high | openai 및 eslint/knip 경로가 함께 있음. 수정판 4.6.6 이상을 포함한 SDK·개발 도구 호환성 확인 |

특히 Sentry의 [공급자 advisory](https://github.com/getsentry/sentry-javascript/security/advisories/GHSA-mchm-gjx6-7h55)는 tunnelRoute 설정, webpack 빌드, 해당 prefix의 앱 경로, middleware만의 인가라는 전제를 설명한다. 현재 `next.config.js`에는 tunnelRoute가 없고 기본 build는 Turbopack이며 API 서버 인가도 별도로 있다. **현재 서비스의 인증 우회가 입증된 것은 아니다.** npm 레지스트리 집계 critical과 공급자 페이지의 현재 Moderate 표시도 다르므로 어느 값을 서비스 자체의 심각도로 복사하지 않는다. 다만 현행 CI는 `npm audit --audit-level=moderate`를 실행하므로 배포 후보의 감사 실패는 해소해야 한다.

자동 `npm audit fix --force`는 실행하지 않는다. `npm@10.9.4`로 필요한 패치와 lockfile만 갱신하고, Sentry 오류/소스맵·단위 테스트·서버 API·브라우저 경계를 재검증한다. 권고/수정 버전은 실제 작업일에 다시 조회한다. Python `pip-audit`, 현재 SHA의 CodeQL·Dependency Review 결과는 이번에 실행/조회하지 않았다.

### 소스에 있는 방어와 남은 증거

- 문의/제안에는 같은 origin 확인·8KiB 본문 제한·필드 검증·honeypot·요청 제한이 있고 결과는 Firestore에 저장된다. **현재 POST 경로는 문의 메일을 발송하는 구현이 아니다.** 출시 검증도 DB 접수와 관리자 조회·처리 흐름으로 정의한다.
- 관리자 API는 revoke 확인을 포함한 Firebase ID token과 서버 `ADMIN_UIDS`를 사용한다. 로그인 화면이 뜨거나 익명 401인 것만으로 등록/미등록 UID 인가를 검증했다고 하지 않는다.
- CSP nonce·보안 헤더·민감 API no-store·Sentry 개인정보 제거·분석에서 개인 경로 제외가 있다. 운영 CSP/HTTPS/도메인, 클라이언트 전환 이후의 분석 유출 여부는 실제 배포에서 별도 확인한다.
- `NEXT_PUBLIC_*` 값은 빌드 산출물에 공개될 수 있는 값이다. Firebase 웹 구성·VAPID 공개키·Kakao JavaScript 키·Sentry DSN·소유확인/IndexNow 키를 서버 비밀과 구분한다. 공개키 제거로 기능을 깨뜨리지 말고 용도별 제한/인가를 확인한다.
- 비공개 서버 credential, 서비스 계정 private key, 관리자 UID 명단, 메일 인증 링크, Meet 소유자/참여자 토큰, 푸시 registration token은 public/docs/log/OG에 넣지 않는다.
- 소스에 있는 Firestore rules/index/TTL 문서가 운영 반영의 증거는 아니다. 적용 project·rules·index READY·TTL·정리 작업과 테스트 사용자 경계를 확인한다.
- 실제 법률 준수 여부를 이 문서로 판정하지 않는다. 약관/개인정보의 수집 항목·목적·보존·위탁/국외 이전·삭제·연락 경로를 운영과 대조하고 필요한 담당 검토를 받는다. 약관 개정 시행 시점은 현재 코드상 2026-11-04 00:00 KST이므로 배포일 앞뒤의 현행/예정 문구를 확인한다.

## 8. 실제 API·운영 환경

설정 값은 [환경 등록 문서](ENVIRONMENT_REGISTRATION.md)에만 관리한다. 이 보고서에는 실제 값을 기록하지 않는다.

| 기능 | 현재 근거 | 배포 후보/운영에서 추가 확인 |
| --- | --- | --- |
| 공지·일정·식단·꿀팁 | 기존 Pages/로컬 fallback 계약 | 활성 manifest/hash·schema·신선도·서로 다른 소스의 실패 격리·정상본 유지 |
| 만나의집 | 이전 실응답/주차 누락 상태 확인 | `NEXT_PUBLIC_CAFETERIA_JSON_URL`, 최신 식단 주차·변경 없을 때 중복 AI 비용 없음 |
| 날씨·대중교통·도서관·강의 | 이전 로컬에서 실제 200, 강의 1,526과목 검증 | Production 키/URL, 타임아웃·오류 복구·공급자 quota, 채움실 비노출과 좌석 맵 순서 유지 |
| 셔틀 위치 | 원본 403/서비스 502의 알려진 외부 제한 | 기존 로직 유지. 장애가 남으면 정적 시간표는 사용 가능하게 하고 운영 이슈로 별도 추적. 성공한 척 가짜 위치 표시 금지 |
| Kakao 지도 | 로컬 Referer 401, 운영 Referer SDK 200이었던 기록 | 실제 Production domain/프로토콜·CSP·모바일 지도와 시설 목록. 모든 오류를 쿠키 탓으로 표시하지 않음 |
| 문의·꿀팁 제안 | 검증·저장 코드와 단위 테스트 | 합성 문의 접수 → ID → 관리자 표시/상태변경. 실패 시 작성값 유지. DB 쓰기 별도 승인 범위 |
| 시간표 공유·Meet | 원래 스키마/토큰/검증 보존 | 테스트 환경의 생성·조회·수정·만료·소유권·삭제·토큰 저장 실패 복구 |
| 룸메이트 | 현재 비활성 운영 플래그 보존 | 비활성 출시 시 메뉴/API 차단 확인. 활성화는 인증 메일·역할·게시·신고·만료까지 별도 출시 |
| 관리자 | 토큰/UID 검증 구현 | 올바른 사용자 성공, 미등록 UID 403, 비어 있는 설정 503, revoke 후 거부 |
| 푸시·메일 | 실제 발송은 미검증 | 테스트 대상만 opt-in/opt-out, 중복 방지·만료·서버 결과·기기 수신. 일괄 발송 금지 |

### 배포 환경과 장애 대응

- Node는 로컬 24.18.0, CI 22.22.2, package engines는 `>=22.22.2`다. Production Node 설정을 확인하고 같은 major에서 릴리스 검사를 수행한다. 현재 설치 Next 16.4.1, React/ReactDOM 19.3.0, Base UI 1.9.0이다. package.json의 범위와 실제 lock 설치 버전을 구분한다.
- Production/Preview/Development의 Firebase project·관리자 권한·FCM·Sentry·Kakao·API 키 범위를 확인한다. Preview가 운영 DB 쓰기·알림 발송에 연결되지 않도록 한다. 로컬 검사 시 env를 복사하지 않았다는 사실과 운영 env 완비는 별개다.
- 루트 main CI 성공 후 mirror로 복사하고 Vercel이 배포하는 기존 경로를 유지한다. 워크플로 파일이 있다는 사실은 최근 실행 성공을 의미하지 않는다. 최신 main 충돌·보호 규칙·필수 check·mirror 변수는 배포 시 재조회한다.
- 오류 감시는 UI용 상태 문구를 다시 늘리는 대신 운영 dashboard에서 한다. Sentry release/source map 수신, API별 5xx/429·latency·데이터 노후·crawler 실패·쿼터·비용 경보를 확인한다. 로그에 payload/토큰/연락처를 넣지 않는다.
- 롤백 대상을 앱 SHA, Pages 데이터 버전, 환경 설정, DB schema/TTL, PWA/Android로 나눈다. 앱을 되돌린다고 원격 데이터·발송·삭제가 되돌아가지는 않는다.

## 9. 리팩터링 범위와 순서

| 대상 | 관찰 | 최소 작업 / 검증 |
| --- | --- | --- |
| 페이지 metadata | 같은 locale/header/title 코드 반복, 실제 OG 누락 발생 | 작은 공통 구성 함수로 title/description/social/image 생성. canonical/search/noindex는 각 화면 의도를 보존 |
| M3 CSS | 전역 import 및 `.relative`, `>div:first-child`, `.max-w-4xl`, `:has(...)` 등 DOM/기존 utility 구조 의존 | 변경할 컴포넌트부터 의미 있는 class/data attribute로 옮김. 컴포넌트 DOM 수정과 CSS를 함께 검토. `:has` 자체를 결함으로 보지 않음 |
| Container | size `md`는 여전히 `max-w-4xl`, 실폭은 M3 규칙이 덮어씀 | 크기 정책을 한 곳으로 정리하되 실제 현재 폭·헤더 정렬 보존. 단순 class 삭제로 폭 회귀 금지 |
| 시간표 | 2,748행 | 검색/선택/저장 도메인과 렌더링을 기능 단위로 분리. 최대 4안·충돌·필터·초안 TTL·인쇄·공유 계약 검사 |
| 졸업요건 | 1,553행 | 종속 선택/평가 규칙은 기존 helper 사용. UI 분리 시 저장 스키마·값 초기화 조건 불변 |
| 셔틀 | 1,204행 | 정적 시간표와 실시간 표시 책임 분리 후보. 공급자 실패를 이유로 protocol 교체 금지 |
| 약관/개인정보 | 636/1,335행 | 번역·정책 콘텐츠 분리 여부 검토. 긴 법적 문구 자체를 불필요하다고 삭제하지 않음 |
| 공통 Select·상태·모션 | 이미 공유 구현 있음 | 새로운 라이브러리 추가보다 기존 사용처 일관성, 접근성·포커스·portal 검사 |

행 수는 복잡도 검토의 단서이며 그 자체가 출시 차단 결함은 아니다. metadata 실제 결함을 먼저 고치고, 출시 직전 대규모 재작성은 피한다. `!important`를 일괄 삭제하지 않는다. 인쇄·움직임 줄이기 규칙의 우선순위는 의도된 경우가 있다. 정상 시간표·달력·좌석 격자와 목록은 모서리를 일괄 둥글게 바꾸지 않는다.

저장소 계약은 `syu-campus-graduation-self-check-v2`, `syu-campus-timetable-draft-v1` 및 기존 Meet token 키·형식·TTL을 보존한다. 서로 다른 origin의 localStorage는 자동 이전되지 않는다. 리팩터링을 저장 형식 변경과 묶지 않는다.

## 10. UI·접근성·PWA 출시 검증

전체 37페이지는 [기존 경로 목록](M3_SERVICE_IMPLEMENTATION_2026-10-26.md)의 기능군으로 다시 검사한다. 비활성/실패 화면까지 정상 성공으로 세지 않는다.

- 데스크톱/모바일: 대표 폭과 899↔900 탐색 전환, 한글·영어, 긴 제목/세 자리 페이지, 200% 확대, 모바일 키보드·safe area·가로 overflow.
- 키보드/보조기술: 검색·Select·모달 focus trap/복귀, Arrow/Enter/Escape, hover와 클릭 모두의 메뉴 접근, 오류 field 연결·live region, 사용자 정의 focus-visible, 대비·reduced motion.
- 브라우저: 실제 iOS Safari/Android Chrome, desktop Chrome/Firefox/Safari. `appearance: base-select` 미지원 환경의 남은 native Select를 확인한다.
- 오류: API timeout/offline/부분 실패/429/오래된 데이터, 재시도·작성값·검색 조건·복귀 보존. 사용자에게 무관한 기술 로그를 노출하지 않는다.
- PWA: manifest 200·id/start_url/scope·설치·기존 설치 업데이트·새 아이콘·notification click·권한 거부/복원. 현재 서비스워커는 fetch offline cache를 제공하지 않으므로 “오프라인 사용 가능”을 약속하지 않는다.
- TWA: `check:twa`와 Android 빌드·서명·Play certificate/Digital Asset Links·실기기 설치는 다른 게이트다. 새 로고와 달리 기존 스토어 screenshot 6개는 이전 UI이므로 Android 출시 시 갱신한다. 웹만 배포할 때 store 승인을 웹 게이트로 묶지는 않는다.
- 이전 여백 평가의 도서관 약 199px 공백, 학식 상단 간격, 모바일 긴 초기 카드 등은 별도 개선 목록에 남긴다. 이번에 임의로 폭·간격을 수정하지 않았다.

## 11. 문서 정리와 공개 저장소

세부 파일별 처리·삭제 금지 사유는 [별도 정리 문서](PUBLIC_REPOSITORY_CLEANUP_2026-10-26.md)에 있다. 핵심은 다음과 같다.

1. `MAINTENANCE.md`의 홈 4개 조회·학식/셔틀 제거 설명을 현행 7개 작업/대시보드에 맞춘다.
2. `M3_SERVICE_IMPLEMENTATION...`의 “Select는 문의/학과에만”·8개 열람실·초기 로고 등 시점 설명을 후속 최종 상태와 구분한다. 현재 언어/페이지 Select 적용 및 채움실 제외 7개와 혼동하지 않도록 기준일/대체 문서 링크를 둔다.
3. `DESIGN_UX_AUDIT_2026-10-18.md` 175,446B의 중간 실험 기록을 현행 가이드로 읽지 않게 archive/요약한다. 원인·실패 조건·재현·미검증 경계는 보존한다.
4. `PERFORMANCE.md`는 이전 fixture 수치와 현재 M3 운영 후보를 별도 섹션으로 유지한다. 수치가 좋아 보인다는 이유로 비교 조건을 합치지 않는다.
5. 공개 README는 실행 방법·환경 키 예제·테스트·기여·출처·정책·현행 기능으로 구성한다. 개인 PC 경로·숨겨진 설정 값·HAR·개인 데이터·실험 캡처는 넣지 않는다.

## 12. 완료 판정과 이번 실행 결과

문서 작성의 완료와 배포 준비 완료는 다르다. 출시 승인은 [체크리스트](RELEASE_CHECKLIST_2026-10-26.md)의 P0 게이트와 이번 배포 범위의 P1 증거를 검토한 뒤 결정한다. 미해결 외부 장애를 수용한다면 제공 기능·대체 화면·담당자·재확인 조건을 명시한다.

이번 실행 결과는 아래에 기록한다. 문서만 변경했으므로 새 제품 빌드·새 전체 37페이지 상호작용·실제 발송·운영 배포를 실행하지 않았다.

| 검사 | 이번 결과 |
| --- | --- |
| HTTP 메타데이터 67 URL / sitemap 전체 parse | 실행 완료. 위 확인 사항 존재 |
| npm audit | **실패(exit 1)**. DEP-01 |
| 추적 파일/공개 이미지 사용처/제한된 secret 패턴 | 실행 완료. 전체 이력 비밀정보 무결성 보장은 아님 |
| 문서 링크·개인 경로·diff 확인 | 문서 4개, 로컬 링크 40개 정상. 검사한 개인 경로/비밀 패턴 0개, `git diff --check` 통과 |
| 전체 타입 | `npm run type-check` exit 0 |
| 관련 SEO 회귀 테스트 | sitemap·announcement-list-query·next.config·proxy·indexnow-workflow 5파일 64테스트 통과. 현재 OG 누락을 포괄하는 테스트가 있다는 뜻은 아님 |
| 최신 CI·Vercel·검색콘솔·실사용 CWV·실제 기기/쓰기 | 미실행, 별도 출시 게이트 |
