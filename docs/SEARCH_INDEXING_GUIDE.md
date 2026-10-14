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

## Monitoring

Track these signals weekly after release:

- Naver Search Advisor collection/indexing reports and Bing Webmaster Tools URL Inspection/Sitemaps status.
- GSC Pages report for indexed Korean URLs and indexed English URLs.
- GSC Sitemaps report for discovered URL count.
- URL Inspection result for representative Korean and English pages.
- Search query impressions for Korean terms such as `삼육대 학사일정`, `삼육대 학식`, `삼육대 셔틀`.
- Search query impressions for English terms such as `Sahmyook academic schedule` and `Sahmyook cafeteria`.
