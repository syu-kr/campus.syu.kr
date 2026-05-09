# Project Guidelines

## Code Style

- Use TypeScript and React function components throughout the app.
- Follow the existing file boundaries: route-specific UI in `app/`, shared UI in `app/components/`, utilities in `lib/`, and shared types in `types/`.
- Match the local style of nearby files instead of introducing new patterns unless the task requires it.
- Keep styling aligned with the current Tailwind-based component system and existing design language.
- Memoize reusable components (`React.memo`) to prevent unnecessary re-renders in lists.

## Architecture

### Project Structure

- **Next.js 14 App Router** with client-side React Query and server-side API routes that call external APIs, Firebase, and JSON data.
- **`app/`** - Domain-specific routes (academic, campus, more, privacy, terms)
- **`app/components/`** - Shared UI components used across routes
- **`app/api/`** - API routes that proxy/transform external data (weather, bus locations, notifications)
- **`lib/`** - Shared utilities: data fetching (api.ts, firebase.ts), helpers (utils.ts, weather.ts), custom hooks (use-versioned-query.ts)
- **`public/data/`** - Static datasets in JSON format (announcements, schedules, cafeteria menus, campus tips)
- **`public/service-notices/`** - Markdown files with YAML frontmatter for service announcements
- **`types/`** - Centralized TypeScript definitions (Announcement, WeatherData, BusArrival, etc.)

### Data Flow

```
React Component
  → useQuery() with feature-specific staleTime/gcTime
  → lib/api.ts (JSON), lib/firebase.ts (realtime), or app/api/* (proxied data)
  → External APIs / Static JSON / Firebase
```

## Data Fetching Patterns

### Static JSON Data (Primary)

Most app data comes from `public/data/` JSON files:

```typescript
// lib/api.ts pattern
export async function fetchAnnouncements(
  category?: string,
): Promise<Announcement[]> {
  try {
    const data = await fetchJson<Announcement[]>(
      "/data/announcements-academic.json",
      { fallback: [] },
    );
    return data;
  } catch {
    return []; // Graceful fallback to empty state
  }
}
```

Use `fetchJson` from `lib/fetch-json.ts` for JSON data. Do not set `cache: "no-store"` and `next.revalidate` together; Next.js warns because they express overlapping cache policies.

### External Government APIs (via API Routes)

API routes act as a proxy/adapter layer—transform external data into app types:

```typescript
// app/api/weather/route.ts - Calls Korean meteorology API
const response = await fetch(
  `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/...`,
  {
    cache: "no-store",
  },
);
const data = await response.json();
return NextResponse.json(transformWeatherData(data)); // Return normalized data
```

**Important:** Some government APIs require HTTP, not HTTPS. See [Debugging notes](#debugging--gotchas) below.

### Firebase (Real-time + Push Notifications)

Split between client and server code:

```typescript
// lib/firebase.ts (Client) - Browser-safe NEXT_PUBLIC_* variables
import { getMessaging, onMessage } from "firebase/messaging";
const messaging = getMessaging(app);

// lib/firebaseAdmin.ts (Server) - Service account JSON from environment
const app = admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT),
  ),
});
```

See [DEVELOPMENT.md](../DEVELOPMENT.md) for detailed setup.

### React Query Configuration

```typescript
// app/providers.tsx - Feature-specific queries can override these defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 0,
    },
  },
});
```

Use explicit `staleTime` and `gcTime` per feature. Static JSON datasets can use longer values, while live transit data can use short polling intervals.

## Environment Variables

### Browser-safe (NEXT*PUBLIC*\*)

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_KAKAO_MAP_KEY=...
NEXT_PUBLIC_PUBLIC_DATA_SERVICE_KEY=...
```

### Server-side Only

```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}
```

### Proxy Configuration (vercel.json)

Bus API is proxied via `vercel.json` rewrites (see package.json proxy configuration).

- Shuttle realtime endpoint: call `/bus/shuttle` in app code.
- Rewrite `/bus/shuttle` to `http://nexmotion.co.kr/bus/busStatusList.php`.
- The upstream endpoint supports `GET` only (do not use `POST`).

## Build and Test

- Install dependencies with `npm install`.
- Start local development with `npm run dev`.
- Validate production builds with `npm run build`.
- Run the production server with `npm start`.
- Run linting with `npm run lint`.
- Run type checks with `npm run type-check`.
- Analyze bundle size with `npm run build:analyze`.
- Use `npm run send-daily-notification` and `npm run cleanup-tokens` for scheduled maintenance scripts.
- Target **Node.js 18.17 or newer**.

## Conventions

### ⚠️ CRITICAL: Real Data Only

- **Never add dummy or mock data** to production. Data in `public/data/` should come from real sources or curated source material.
- If adding development-only mock data, mark it clearly (e.g., `// DEV ONLY - Remove before merging`).

### Data Handling

- Error handling follows the "silent fallback" pattern: catch errors and return empty arrays.
- Components must gracefully handle empty states (show empty UI, not error messages).
- Keep Firebase usage aligned with the browser-safe vs. server-side credential split.

### File Organization

- Domain-specific components stay in `app/components/` (e.g., AnnouncementCard).
- Shared UI components live in `app/components/`.
- Utilities belong in `lib/` (data fetching, helpers, custom hooks).
- Use `lib/utils.ts` for date formatting (`formatDate`, `formatDateKorean`), labels, and colors.

### Documentation and Links

- Prefer linking to existing docs instead of duplicating repository details here.
- See [DEVELOPMENT.md](../DEVELOPMENT.md) for full architecture, API setup, and deployment.
- See [README.md](../README.md) for product overview and quick start.
- See [PERFORMANCE.md](../PERFORMANCE.md) for bundle analysis and optimization.

## Debugging & Gotchas

### Common API Issues

**Government APIs (data.go.kr):**

- Some require HTTP, not HTTPS. If you get 403 on `https://apis.data.go.kr/...`, try `http://` instead.
- Verify the service key and that per-API approval (활용신청) is granted.

**Seoul Bus API (ws.bus.go.kr):**

- **HTTPS connections timeout**. Always use HTTP: `http://ws.bus.go.kr/api/rest/arrive/getArrInfoByStId`
- Gyeonggi bus API (apis.data.go.kr) works with HTTPS.

**Shuttle Realtime API (nexmotion.co.kr):**

- Use proxied path `/bus/shuttle` rather than upstream URLs directly in client code.
- Upstream `http://nexmotion.co.kr/bus/busStatusList.php` accepts `GET`.
- Response `status` may arrive as a string (`"0" | "1" | "2"`), so normalize to number before filtering/rendering.

**Safari Date Parsing:**

- Do not rely on `new Date("YYYY.MM.DD")` parsing in UI logic.
- Parse dotted dates explicitly (or normalize to numeric constructor args) before formatting to avoid `NaN` rendering in Safari.

**Vercel Edge/API Timeout:**

- Default fetch timeout is 10 seconds. If external servers timeout from Vercel but work locally, use `vercel.json` rewrites + `package.json` proxy instead of fetch in API routes.

### React Query & Caching

- The app defines React Query defaults in `app/providers.tsx`, but feature queries should choose practical caching values.
- Static JSON sources such as campus tips can use longer `staleTime`; live transit data should keep short polling intervals.

### XML/Regex Extraction

- Regex-based XML extraction can silently fail on nested/complex responses. Prefer depth-aware tag matching or a real XML parser in Edge Functions.

### Notification Tokens

- FCM tokens are stored with a unique index. Use a service-role Edge Function for register/unregister so tokens move cleanly between users on logout/login.

### Image Optimization

- Use Next.js `Image` component for automatic AVIF/WebP conversion and lazy loading.
- Inline SVG icons via `dangerouslySetInnerHTML` for weather icons (generated dynamically based on conditions).
