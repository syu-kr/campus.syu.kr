# SYU CAMPUS i18n Policy

SYU CAMPUS is Korean-first, with an English UI layer for global users.

This document defines what should be translated, what should remain as source data, and how to avoid new hardcoded UI strings.

## Supported locales

- `ko`: default locale and primary product language.
- `en`: global English UI available through `/en`.

The proxy uses the request country header to route non-Korea traffic to `/en` when no explicit locale path is already present. Users can also change the language from the footer country/language selector.

## Translation scope

Translate UI shell and interaction text:

- Navigation, footer, bottom navigation, buttons, tabs, filters, labels, and empty states
- Page titles, descriptions, metadata, and Open Graph copy
- Client-side status, loading, error, and success messages
- Legal and privacy pages for the English route, with Korean originals kept authoritative
- Common component fallback text and accessibility labels

Keep source data in Korean unless a separate product decision is made:

- University notice titles and bodies
- Course names, department names, completion categories, and timetable source fields
- Cafeteria menu items
- Building, facility, route, and stop names
- Library room names and original operating-hour labels
- Any crawler output or official source payload stored under `public/data`

The reason is reliability. These values come from official or source systems, change often, and may be legally or operationally important. Translating them manually would create drift between the source and the displayed value.

## User-facing expectation

The English version should make the service usable, but it does not promise fully translated university content.

When source content is Korean-only, prefer one of these patterns:

- Show the Korean source value as-is.
- Translate the surrounding UI label.
- Add a short notice that source content may remain Korean.
- Provide a small alias only for stable high-level labels, such as `Academic Notices`, `Campus Map`, or `Cafeteria`.

Do not machine-translate official notices, menus, course names, or legal source content inside the app without an explicit review process.

## Development rules

- Add new reusable UI copy to `lib/i18n.ts`.
- Read locale through `LocaleProvider` in client components.
- Read locale from `LOCALE_HEADER_NAME` in server components and metadata functions.
- Use `localizePath` for internal links that should preserve the current locale.
- Keep API and parser logic free to use Korean source keys when those keys are part of the upstream data contract.
- If a Korean string must remain outside `lib/i18n.ts`, document why in `scripts/check_i18n_strings.mjs`.

## Audit

Run the i18n string audit with:

```bash
npm run check:i18n
```

The audit scans public `app/**/*.tsx` files and fails when it finds Korean text that is likely to be hardcoded UI copy. It intentionally ignores:

- `lib/i18n.ts`
- Admin and API routes
- Korean legal originals in `app/terms/page.tsx` and `app/privacy/page.tsx`
- Known source-data keys and error-message mapping tables

The audit is also included in `npm run check`.
