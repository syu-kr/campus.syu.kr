# Project Guidelines

## Code Style

- Use TypeScript and React function components throughout the app.
- Follow the existing file boundaries: route-specific UI in `app/`, shared UI in `app/components/`, root shared components in `components/`, utilities in `lib/`, and shared types in `types/`.
- Match the local style of nearby files instead of introducing new patterns unless the task requires it.
- Keep styling aligned with the current Tailwind-based component system and existing design language.

## Architecture

- This is a Next.js 14 App Router project with client-side React Query and server-side API routes that call external APIs, Firebase, and JSON data.
- Keep route code under the existing sections in `app/` such as `academic/`, `campus/`, `more/`, `privacy/`, and `terms/`.
- Keep API handlers under `app/api/` and preserve the current runtime and caching choices used by nearby handlers.
- Keep static content and generated datasets in `public/data/` and `public/service-notices/` rather than embedding them in components.
- For full project structure and system-level details, see [DEVELOPMENT.md](../DEVELOPMENT.md). For the product overview and quick start, see [README.md](../README.md).

## Build and Test

- Install dependencies with `npm install`.
- Start local development with `npm run dev`.
- Validate production builds with `npm run build`.
- Run the production server with `npm start`.
- Run linting with `npm run lint`.
- Run type checks with `npm run type-check`.
- Use `npm run send-daily-notification` and `npm run cleanup-tokens` for the scheduled maintenance scripts when needed.
- Target Node.js 18.17 or newer.

## Conventions

- Use real crawled data for production content; do not add dummy or mock data unless it is clearly marked for development-only use.
- Keep Firebase usage aligned with the existing split between browser-safe `NEXT_PUBLIC_*` variables and server-side credentials.
- Prefer linking to existing docs instead of duplicating repository details here.
- Follow the current data-fetching and caching patterns already used in `lib/` and the API routes.
