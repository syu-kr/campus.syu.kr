# Search Indexing and Google Search Console Checklist

This guide keeps the SEO, AEO, and GEO work verifiable after deployment.

## Indexing Model

- Korean is the default canonical surface: `https://campus.syu.kr/...`
- English is a separate localized surface: `https://campus.syu.kr/en/...`
- `x-default` points to the Korean route.
- Anonymous crawlers must not be redirected to `/en` only because of country, edge, or accept-language headers.
- Source data that remains Korean-only should stay close to the original data to avoid mistranslation drift.

## Google Search Console Setup

Use one domain property when possible:

- `campus.syu.kr`

Add URL-prefix properties only when separate Korean and English filtering is useful:

- `https://campus.syu.kr/`
- `https://campus.syu.kr/en/`

Submit this sitemap in the domain property and any URL-prefix property:

- `https://campus.syu.kr/sitemap.xml`

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

- GSC Pages report for indexed Korean URLs and indexed English URLs.
- GSC Sitemaps report for discovered URL count.
- URL Inspection result for representative Korean and English pages.
- Search query impressions for Korean terms such as `삼육대 학사일정`, `삼육대 학식`, `삼육대 셔틀`.
- Search query impressions for English terms such as `Sahmyook academic schedule` and `Sahmyook cafeteria`.
