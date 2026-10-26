# SYU CAMPUS i18n Policy

SYU CAMPUS is Korean-first, with an English UI layer for global users.

This document defines what should be translated, what should remain as source data, and how to avoid new hardcoded UI strings.

## Supported locales

- `ko`: default locale, primary product language, and `x-default` search-indexing target.
- `en`: global English UI available through `/en`.

New visitors and crawlers land on the Korean route by default. The English UI is available through the explicit `/en` route, and users can change the language from the footer country/language selector.

The proxy preserves explicit `/en` URLs and a saved locale cookie, but it must not redirect anonymous crawlers to `/en` only because of country or edge headers. This keeps Korean URLs crawlable as first-class canonical pages while still allowing the English route to be indexed separately. A saved language preference takes priority over the default route.

## Translation scope

Translate UI shell and interaction text:

- Navigation, footer, bottom navigation, buttons, tabs, filters, labels, and empty states
- Page titles, descriptions, metadata, and Open Graph copy
- Client-side status, loading, error, and success messages
- Legal and privacy pages for the English route, with Korean originals kept authoritative
- Common component fallback text and accessibility labels

Keep authoritative source data in Korean. The approved English display layer may add reviewed aliases or automatic public-content translations without replacing these values:

- University notice titles and bodies
- Course names, department names, completion categories, and timetable source fields
- Cafeteria menu items
- Building, facility, route, and stop names
- Library room names and original operating-hour labels
- Any crawler output or official source payload stored under `public/data`

These values come from official or source systems and can change often. Original IDs, selected values, search/filter keys, dates, credits, and saved progress remain authoritative. A translation is a separate reading aid.

## User-facing expectation

The English version should make the service usable, but it does not promise fully translated university content.

When source content is Korean-only, prefer one of these patterns:

- Show the Korean source value as-is.
- Translate the surrounding UI label.
- Add a short notice that source content may remain Korean.
- Provide a small alias only for stable high-level labels, such as `Academic Notices`, `Campus Map`, or `Cafeteria`.

The 2026-10-26 implementation adds an explicitly approved public-content translation layer:

- Reviewed English service-notice variants are selected on `/en` only while their normalized source SHA256 matches the Korean original. Slugs, dates, authors, and page ordering are unchanged; stale variants fall back to the original.
- Fixed place and room display aliases keep the Korean source available. They never change source IDs or seat-map ordering.
- Selecting English automatically translates remaining Korean public fields in place. Existing UI dictionaries, reviewed variants and aliases remain preferred; per-item translation buttons and appended translation blocks are removed. The original remains readable on configuration, network, quota, stale-source, or translation failures. One page-level attribution/recovery area accompanies machine-translated content. Selecting Korean restores originals.
- The server resolves allowlisted published IDs and fields itself. It accepts no arbitrary text, URLs, private records, or user input. Only strings containing Korean reach Google. Exact public phrases share a 30-day cache across sources and pages. Credentials, shared daily reservations, and provider calls remain server-side.
- The interface compares the returned public original fields with the displayed snapshot before showing a translation. Long text leaves use deterministic bounded parts and requests; Markdown links/code/structure are preserved. No whole-page HTML or DOM is submitted or mutated outside React.
- Personal timetable names/notes, graduation inputs/progress, inquiries, unpublished suggestions, roommate posts/reports, meet rooms/participants, emails, and administrator data are excluded.
- English readers do not add machine-translated names to existing search/filter indexes. The original search conditions remain valid, and the Korean source is available for matching.
- Existing legal pages retain their reviewed UI/original policy; they are not sent to the automatic translator. Historical legal text inside an English service-notice variant is an editorial translation of that published notice, with the Korean source authoritative.

On 2026-10-26, a real public-title translation returned 200 and reserved 9 input characters; repeating it returned the cached result with 0 additional reserved characters. This is local provider/cache evidence, not a production deployment or billing-statement audit. Further quality sampling remains appropriate. Details: [content translation operations](CONTENT_TRANSLATION.md).

## Development rules

- Keep reusable Korean and English UI copy in `lib/i18n/ko.ts` and `lib/i18n/en.ts`, with matching keys. Feature dictionaries such as `lib/i18n/meet.ts` and `roommates.ts` remain feature-scoped.
- Use `lib/i18n/routing.ts` for locale constants, the `Locale` type, `localizePath`, and other path helpers. This module has no dictionary dependency.
- In client components, read `useLocale` and `useDictionary` from `app/components/LocaleContext.tsx`. Use a type-only import when a component needs `Dictionary` from `lib/i18n.ts`; importing the whole dictionary module as a value adds both languages to client JS.
- `app/components/LocaleProvider.tsx` is a server wrapper. Its client boundary uses the Korean dictionary by default and receives the English dictionary only for English requests. Do not turn the server wrapper into a client component or import it as a value from client code.
- `lib/i18n.ts` keeps `getDictionary`, `dictionaries`, and compatibility exports for server callers. Avoid duplicating dictionaries in individual pages.
- Read locale from `LOCALE_HEADER_NAME` in server components and metadata functions.
- Use `localizePath` for internal links that should preserve the current locale.
- Keep API and parser logic free to use Korean source keys when those keys are part of the upstream data contract.
- If a Korean UI string must remain outside a dictionary, document its specific exception in `scripts/check_i18n_strings.mjs`.

The server wrapper changes where English copy is transferred, not whether it is transferred. Measure HTML/RSC and JS together before claiming a total download reduction. Preserve direct `/en` visits, client navigation, a saved language preference, and a reload in both languages. See [the performance guide](../PERFORMANCE.md) for measurement conditions.

## Audit

Run the i18n string audit with:

```bash
npm run check:i18n
```

The audit scans public `app/**/*.tsx` files and fails when it finds Korean text that is likely to be hardcoded UI copy. It intentionally ignores:

- Dictionary modules under `lib/i18n` (the scan is limited to `app/**/*.tsx`)
- Admin and API routes
- Test and spec files, whose fixtures and assertions are not shipped UI copy
- Korean legal originals in `app/terms/page.tsx` and `app/privacy/page.tsx`
- Known source-data keys and error-message mapping tables

The audit is also included in `npm run check`.

It detects likely hardcoded Korean strings; it does not prove that every English label is correct or every source-data value should be translated. Run relevant locale, provider, navigation, and feature tests, then check both languages in the browser. Changes to the mobile timetable copy also require the [font character coverage check](../app/fonts/syu-timetable-ui/README.md).

Last reviewed against repository code: 2026-10-18. This is an implementation policy, not a record of a successful production rollout.
