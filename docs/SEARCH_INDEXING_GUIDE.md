# Search Indexing and Webmaster Tools Checklist

This guide keeps the SEO, AEO, and GEO work verifiable after deployment.

## Indexing Model

- Korean is the default canonical surface: `https://campus.syu.kr/...`
- English is a separate localized surface: `https://campus.syu.kr/en/...`
- `x-default` points to the Korean route.
- Anonymous crawlers must not be redirected to `/en` only because of country, edge, or accept-language headers.
- Source data that remains Korean-only should stay close to the original data to avoid mistranslation drift.
- The sitemap reads current announcement data per request. New published announcements do not require an app deployment; the announcement and manifest caches each refresh on a 60-second interval, so allow both cache windows before rechecking the sitemap. Announcement detail URLs use matching category/ID pairs and do not claim a modification time without evidence.

## Google Search Console Setup

Use one domain property when possible:

- `campus.syu.kr`

Add URL-prefix properties only when separate Korean and English filtering is useful:

- `https://campus.syu.kr/`
- `https://campus.syu.kr/en/`

Submit this sitemap in the domain property and any URL-prefix property:

- `https://campus.syu.kr/sitemap.xml`

## 네이버·Bing 소유확인 및 사이트맵 제출

인증값이 아직 없으면 `NAVER_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`을 비워 둡니다. 미설정·빈 문자열·공백만 있는 값은 인증 메타태그를 출력하지 않습니다. 한 검색엔진만 설정해도 됩니다.

| 검색엔진 | 환경 변수 | 초기 HTML `<head>`의 메타태그 이름 |
| --- | --- | --- |
| 네이버 | `NAVER_SITE_VERIFICATION` | `naver-site-verification` |
| Bing | `BING_SITE_VERIFICATION` | `msvalidate.01` |

환경 변수에는 발급된 메타태그의 `content` 속성 값만 넣습니다. 전체 `<meta ...>` 문자열이나 따옴표를 넣지 않습니다. 값은 소유확인용 공개 정보이며 HTML에서 확인할 수 있지만, 실제 값은 코드·문서에 커밋하지 않고 배포 환경에서 관리합니다. 서버가 읽으므로 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.

### 네이버 서치어드바이저

1. [서치어드바이저 웹마스터 도구](https://searchadvisor.naver.com/)에 로그인하고 `https://campus.syu.kr`을 등록합니다.
2. 소유확인에서 **HTML 태그**를 선택하고 `name="naver-site-verification"` 메타태그의 `content` 값을 복사합니다.
3. Vercel의 `syu-campus -> Settings -> Environment Variables`에서 `NAVER_SITE_VERIFICATION`을 **Production** 환경에 등록합니다. 운영 소유확인값은 Preview·Development에 필요하지 않습니다.
4. 환경 변수 변경 후 Production을 다시 배포합니다. `view-source:https://campus.syu.kr/` 또는 HTTP 응답 원문에서 해당 메타태그와 정확한 값이 `<head>` 안에 있는지 확인합니다.
5. 서치어드바이저에서 소유확인을 완료한 뒤 **요청 -> 사이트맵 제출**에 `https://campus.syu.kr/sitemap.xml`을 제출합니다.
6. 사이트 진단·수집·색인 리포트에서 루트, 공지 목록과 유효한 공지 상세 URL의 반영 상태를 확인합니다.

네이버 소유확인은 JavaScript를 실행하지 않으며 `<body>`의 인증 메타태그를 인정하지 않습니다. 따라서 이 앱은 기존 루트 레이아웃의 `<head>`에서 인증 태그를 서버 렌더링합니다. 개발자 도구의 실행 후 DOM만 확인하지 말고 페이지 소스도 확인합니다. [소유확인 공식 안내](https://searchadvisor.naver.com/guide/faq-start-register), [사이트맵 공식 안내](https://searchadvisor.naver.com/guide/request-feed)

### Bing Webmaster Tools

1. [Bing Webmaster Tools](https://www.bing.com/webmasters/)에 로그인합니다. 이미 소유확인한 Google Search Console 사이트가 있으면 **가져오기**를 사용할 수 있습니다. DNS 인증을 선택할 수도 있으며 두 방식 모두 메타태그 환경 변수를 설정할 필요는 없습니다.
2. 사이트를 직접 추가하고 HTML 메타태그로 인증한다면 `https://campus.syu.kr`에 발급된 `name="msvalidate.01"` 태그의 `content` 값만 복사합니다.
3. Vercel Production에 `BING_SITE_VERIFICATION`을 등록하고 Production을 다시 배포합니다.
4. `view-source:https://campus.syu.kr/` 또는 HTTP 응답 원문의 `<head>`에 값이 있는지 확인한 뒤 Bing의 소유확인을 완료합니다.
5. **Sitemaps**에서 `https://campus.syu.kr/sitemap.xml`을 제출하거나, 가져온 사이트맵 목록에 같은 주소가 있는지 확인합니다. URL Inspection으로 대표 URL의 검색 수집 상태를 확인합니다.

인증 태그를 사용한 경우 소유확인 후에도 환경 변수를 유지합니다. [Bing 사이트 추가·인증 공식 안내](https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b), [메타태그 공식 안내](https://learn.microsoft.com/en-us/bingwebmaster/verifying-wordpress), [사이트맵 공식 안내](https://www.bing.com/webmasters/help/sitemaps-3b5cf6ed)

소유확인·사이트맵 제출 완료와 실제 수집·색인·검색 노출은 각각 별도로 확인합니다. 인증이나 제출이 상위 노출 또는 AI 인용을 보장하지는 않습니다. GEO 본문·출처 보완과 IndexNow 변경 알림은 별도 작업입니다.

## Deployment Checks

After deployment, inspect these representative Korean URLs first:

- `https://campus.syu.kr/`
- `https://campus.syu.kr/academic/schedule`
- `https://campus.syu.kr/academic/graduation`
- `https://campus.syu.kr/campus/cafeteria`
- `https://campus.syu.kr/campus/bus-info`
- `https://campus.syu.kr/campus/phone`

Then inspect the English equivalents:

- `https://campus.syu.kr/en`
- `https://campus.syu.kr/en/academic/schedule`
- `https://campus.syu.kr/en/academic/graduation`
- `https://campus.syu.kr/en/campus/cafeteria`
- `https://campus.syu.kr/en/campus/bus-info`
- `https://campus.syu.kr/en/campus/phone`

Each inspected page should show:

- HTTP 200 for its own URL, not a forced redirect to the other locale.
- A canonical URL matching the current locale route.
- `hreflang` alternates for `ko`, `en`, and `x-default`.
- Structured data scripts for the page answer or site identity when applicable.
- Visible source, verification, or trust metadata on answer-oriented pages.
- The announcement list and a current valid announcement detail URL expose their primary content and detail links without JavaScript.
- Configured Naver/Bing verification tags appear in the initial HTML head; unset tags are absent.
- Anonymous Yeti and Bingbot requests can read the public pages and sitemap without deployment protection.
- Protected routes such as admin and roommate pages stay outside the sitemap and retain authentication/noindex controls.

## GSC URL Inspection Flow

1. Inspect the Korean URL first.
2. Confirm Google sees the canonical as the Korean URL.
3. Request indexing for the Korean URL when the page is new or materially changed.
4. Inspect the English `/en` URL separately.
5. Confirm Google sees the canonical as the English URL.
6. Request indexing for the English URL only after the Korean URL is crawlable.

If GSC shows only the English URL, check these in order:

1. The deployed root URL does not redirect crawlers to `/en`.
2. The sitemap contains both the Korean and English URLs.
3. The Korean page canonical does not point to `/en`.
4. The Korean page has an `x-default` alternate pointing to the Korean URL.
5. The Korean URL is not blocked by `robots.txt`, middleware, or deployment protection.

## Current M3 metadata, content language, and data state

- Page metadata uses complete shared OG/Twitter fields. Nested `openGraph` objects replace inherited fields, so public pages explicitly retain the shared image with their own title, description, locale, and social URL.
- Korean announcement source titles, text, and AI summaries remain Korean on the English UI. Source regions use Korean language markup and Article `inLanguage` is `ko-KR`. Navigation and labels remain localized. The English URL is an English reading interface, not a claim that the original notice was translated. Service notice source titles and bodies follow the same rule.
- KO/EN routes stay self-canonical with reciprocal alternates. A later translation/canonical policy change must update HTML, sitemap, links, and IndexNow together.
- Public announcement lists/details render content and links on the server. Competitions and campus tips also receive server snapshots and restore validated filters from the URL. Search/filtered variants are noindex with a base canonical; unfiltered page URLs use their own page canonical.
- Current schema includes site identity, announcement Article, and real FAQ on graduation/phone pages. Do not assume cafeteria/shuttle/schedule still output FAQ schema from an older implementation.
- Google discontinued FAQ rich results starting May 7, 2026. Useful Q&A can remain, but schema count does not guarantee a search feature or GEO result. See [Google's update log](https://developers.google.com/search/updates).
- Normal UI does not display internal collection logs or generic update messages. Keep the actual meal date/week, announcement publication date, base shuttle update date, and meaningful stale/error/retry states.
- Snapshot `sourceHealth.lastSuccessAt`, version, and source verification remain operational data. Request time, file modification, Git commit time, and an answer calculation time must not substitute for source verification. Keep source-specific dates separate.
- API freshness fields and retained-data contracts remain compatible. A previous observation or missing meal week must not be represented as fresh current data. Validate visible text and any schema against the same snapshot.
- AI text files and GEO-only markup are not required. Prioritize crawlable text, actual sources, accurate language, and useful content. See [Google's generative search guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).

## IndexNow 변경 알림 (PR 3)

IndexNow는 새로 추가·수정·삭제된 공개 URL을 검색엔진에 알립니다. `https://api.indexnow.org/indexnow`에 한 번 제출하며 참여 검색엔진에 공유됩니다. Naver/Bing 메타태그 소유확인과 별개입니다. HTTP 200은 수신, 202는 키 검증 대기이며, 수집·색인·검색 노출·AI 인용 완료를 뜻하지 않습니다. [공식 명세](https://www.indexnow.org/documentation), [FAQ](https://www.indexnow.org/faq), [네이버 안내](https://searchadvisor.naver.com/guide/indexnow-about)

### 활성화 순서

1. 이 변경을 운영 배포한 뒤 `https://campus.syu.kr/indexnow-key.txt`의 본문이 저장소의 `public/indexnow-key.txt`와 같은지 확인합니다. 이 값은 공개 소유확인 키이며 비밀 API 토큰이 아닙니다. 별도 Naver/Bing 인증값이나 새 GitHub secret은 필요하지 않습니다. UTF-8 키 파일과 명시적인 `keyLocation`을 사용합니다. [네이버 키 규칙](https://searchadvisor.naver.com/guide/indexnow-api-key)
2. 운영 `https://campus.syu.kr/indexnow-deployment.json`의 `sourceSha`가 원본 저장소의 배포 커밋인지 확인합니다. 이 파일은 기존 Sync workflow가 배포 저장소에만 생성하며, 인덱싱 대상에 넣지 않습니다.
3. 원본 저장소 Actions variable `INDEXNOW_ENABLED=true`를 설정합니다. 미설정 상태에서는 `Notify IndexNow` job이 건너뛰므로 PR 작성·CI에서 운영 제출을 실행하지 않습니다.
4. Actions의 `Notify IndexNow`를 main에서 수동 실행합니다. 기본 `send=false`는 dry-run입니다. 실제 처리는 `send=true`로 실행합니다. 첫 실제 실행은 확인된 현재 URL 지문을 **baseline으로 저장하고 전체 과거 URL을 제출하지 않습니다.** 이후 성공한 코드 동기화·Daily Crawl·Rollback 게시 완료가 자동 처리를 시작합니다.

로컬에서는 `npm run indexnow`로 공개 데이터를 읽어 변경 계획만 확인합니다. `--send`를 지정하지 않으면 제출·운영 probe·이전 상태 수정은 없습니다. 실제 전송은 clean committed checkout에서만 허용됩니다. 수동 비교에는 `--state-file`, `--report-file` 경로를 지정할 수 있으며 기본 파일은 `.cache/indexnow/state.json`, `.cache/indexnow/report.json`입니다.

### 변경 판단과 게시 확인

- sitemap과 같은 공개 경로 목록을 사용하며 한·영 URL을 각각 관리합니다. 공지별 본문·유효한 AI 요약, 학식·공휴일 내용, 정적 자료·서비스 공지 및 페이지 코드 지문을 비교합니다. 이전 상태에만 남은 공개 URL은 삭제 알림 대상입니다. admin, roommate, API, 개인 방·공유 경로를 제출하지 않습니다.
- 지문을 만들 때 객체 키·소스 파일 경로·홈 공지 날짜 정렬은 운영 기준선과 같은 `en-US`를 명시합니다. Windows의 한국어 기본 정렬 때문에 내용이 같은 졸업요건 URL을 변경으로 오탐하지 않으며, 기존 운영 기준선을 초기화할 필요가 없습니다.
- 확인 시각·발행 시각·조회수·AI 생성 이력·오류 코드만 달라진 경우나 현재 시간·셔틀 countdown만 흐른 경우는 제출하지 않습니다. 학식·공휴일의 source-health stale 전환은 답변을 바꾸므로 알림 대상입니다. 코드 의존성은 명시적인 경로 매핑이며 공통 UI·번역 변경은 공개 페이지를 보수적으로 무효화합니다. 페이지나 데이터 공급 경로를 추가할 때 `scripts/indexnow-snapshot.ts`의 매핑과 회귀 테스트도 함께 갱신합니다.
- 코드 SHA marker, 공개 키 파일, 운영 데이터 API의 `X-Crawl-Data-Source`와 버전을 확인합니다. source는 `PUBLIC_DATA_BACKEND=firebase`일 때 `firebase-storage`, Pages 모드일 때 `github-pages`여야 합니다. 새 활성 데이터 버전은 이번 실행에서 처음 관측한 시각부터 최대 6분의 캐시 갱신 구간을 둡니다. rollback의 옛 `publishedAt`을 새 게시 시각으로 취급하지 않습니다.
- 변경된 정적 페이지와 각 공지 category/언어·서비스 공지 template의 대표 URL은 HTTP 200, 일치하는 canonical, noindex 없음이 모두 필요합니다. 전체 과거 공지에 대량 HTTP probe를 하지 않습니다. 삭제는 404/410, 리디렉션 또는 HTTP 200의 streaming noindex 응답만 인정하며, 503 등의 오류 응답을 삭제로 간주하지 않습니다. 제출 직전과 각 재시도 직전에 source SHA와 선택한 backend의 활성 데이터 버전을 다시 대조하며 중간에 배포가 바뀌면 중단합니다.

### 상태, 재시도와 실패 복구

- 신뢰된 main의 동일 IndexNow workflow artifact 중 생성 시각이 가장 최신인 상태를 복원하며 실행은 직렬화합니다. 예전 실행을 재실행한 경우도 run 번호보다 artifact 생성 시각을 우선해 최신 제출 이력을 보존합니다. 손상된 상태·조회·다운로드 오류는 baseline으로 조용히 초기화하지 않습니다. 실제 첫 실행에만 baseline을 만들고, dry-run은 기존 상태를 변경하지 않습니다.
- URL 중복을 제거하고 최대 10,000개씩 전송합니다. 같은 URL의 내용이 5분 내 다시 바뀌면 간격을 기다린 뒤 재검증합니다. 수락된 배치마다 지문을 저장하므로 뒷배치 실패 후 재실행할 때 완료된 작업을 반복하지 않습니다.
- 네트워크·5xx는 짧은 backoff로 최대 3회 시도합니다. 400/403/422는 설정/입력 오류로 중단합니다. 429는 `Retry-After`를 존중하고 최소 10분 후 한 번만 재시도하며, 더 긴 대기가 요구되면 즉시 중단하고 나중에 실행하도록 기록합니다. 각 재시도의 상태·횟수·대기시간을 Actions 로그에 남깁니다.
- `indexnow-state`와 `indexnow-report` artifact는 90일 보존합니다. 부분 실패에서도 마지막으로 저장된 상태와 오류 보고서를 유지합니다. 실패 후 원인을 수정하고 main에서 `send=true`로 다시 실행하면 남은 차이를 처리합니다. 90일 이상 상태가 없으면 이전 변경 이력을 추측하지 않고 새 baseline부터 시작합니다.
- 보고서의 accepted/키 검증 대기 수와 실제 Webmaster Tools 색인 상태는 별개로 확인합니다. 공개 키 파일을 회전할 때는 파일 배포를 먼저 확인합니다. 제출 성공으로 네이버·Bing 계정 소유확인까지 완료됐다고 판단하지 않습니다.

## Monitoring

Track these signals weekly after release:

- Naver Search Advisor collection/indexing reports and Bing Webmaster Tools URL Inspection/Sitemaps status.
- GSC Pages report for indexed Korean URLs and indexed English URLs.
- GSC Sitemaps report for discovered URL count.
- URL Inspection result for representative Korean and English pages.
- Search query impressions for Korean terms such as `삼육대 학사일정`, `삼육대 학식`, `삼육대 셔틀`.
- Search query impressions for English terms such as `Sahmyook academic schedule` and `Sahmyook cafeteria`.
