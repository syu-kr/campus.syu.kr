import { createHash } from "node:crypto";
import { PUBLIC_ROUTES } from "../lib/public-routes";
import { getMatchingAnnouncementAiSummary } from "../lib/server/announcement-ai";
import { getCompetitionMatch, toCompetitionCandidate } from "../lib/server/competitions";
import type { Announcement, AnnouncementAiSummary, CompetitionSourceCategory, ShuttleSpecialPeriods } from "../types";

export type SnapshotFile = { hash: string; data?: unknown; stale?: boolean };
export type IndexNowSnapshot = Record<string, string>;
const ORIGIN = "https://campus.syu.kr";
const SOURCES = {
  academic: "announcements-academic.json", campus: "announcements-campus-life.json",
  scholarship: "announcements-scholarship.json", sw: "announcements-sw.json",
} as const;
const COLLECTIONS = {
  academic: "/academic/announcements", campus: "/campus/announcements",
  scholarship: "/academic/scholarship", sw: "/academic/sw-notices",
} as const;
const GRADUATION_FILES = [
  "graduation-department-rules.json", "curriculum-course-selection-rules-2026.json",
  "curriculum-courses-2026-verified.json", "graduation-requirements-2026.json", "graduation-sources.json",
] as const;
const ROUTE_CODE: Record<string, readonly string[]> = {
  "/": ["app/features/cafeteria/CafeteriaMenuCards.", "app/features/shuttle/ShuttleAdditionalServicesCard.", "lib/search.", "lib/phone."],
  "/academic/competitions": ["app/features/academic/CompetitionsPageClient.", "lib/server/competitions.", "app/api/competitions/"],
  "/academic/schedule": ["app/features/academic/SchedulePageClient.", "lib/use-url-search."],
  "/academic/graduation": ["app/features/academic/GraduationPageClient.", "app/features/academic/graduation-persistence.", "lib/graduation."],
  "/academic/timetable": ["lib/lecture-timetable", "lib/timetable-", "app/api/lecture/timetable/", "lib/fetch-json."],
  "/campus": ["app/features/roommates/RoommateMenuLink.", "lib/roommates.", "lib/roommate-link-privacy."],
  "/campus/bus-info": ["lib/kakao-maps-loader."],
  "/campus/library": ["lib/library."],
  "/campus/map": ["lib/kakao-maps-loader."],
  "/campus/phone": ["lib/phone.", "lib/use-pagination.", "lib/use-url-search."],
  "/campus/campus-tips": ["lib/use-pagination."],
  "/more/meet": ["lib/meet.", "app/api/meet/rooms/"],
  "/privacy": ["app/features/legal/"],
  "/terms": ["app/features/legal/"],
};
const VOLATILE = new Set([
  "lastUpdated", "lastSuccessAt", "lastAttemptAt", "checkedAt", "publishedAt", "generatedAt",
  "crawledAt", "views", "sourceHash", "inputHash", "detailContentHash", "model", "contentSource",
]);

// Keep the production baseline's ordering regardless of the host locale.
export function buildIndexNowSnapshot(files: Record<string, SnapshotFile>): IndexNowSnapshot {
  const result: IndexNowSnapshot = {};
  const data = (name: string) => files[`public/data/${name}`]?.data ?? null;
  const codes = new Map<string, string>();
  const code = (route: string) => {
    const template = route.startsWith("/announcements/") ? "/announcements/[category]/[id]"
      : route.startsWith("/service/notices/") ? "/service/notices/[slug]" : route;
    if (!codes.has(template)) {
      codes.set(template, digest(Object.entries(files).filter(([file]) =>
        !/\.(test|spec)\./.test(file) && isRouteCode(file, template),
      ).sort(([a], [b]) => a.localeCompare(b, "en-US")).map(([file, value]) => [file, value.hash])));
    }
    return codes.get(template)!;
  };
  const put = (route: string, content: unknown) => {
    const hash = digest([code(route), semantic(content)]);
    result[`${ORIGIN}${route}`] = hash;
    result[`${ORIGIN}${route === "/" ? "/en" : `/en${route}`}`] = hash;
  };
  const contentByRoute: Record<string, unknown> = {};
  const aiData = data("announcement-ai-metadata.json") as { items?: Record<string, AnnouncementAiSummary> } | null;
  const allAnnouncements: ReturnType<typeof visibleAnnouncement>[] = [];
  for (const [category, file] of Object.entries(SOURCES)) {
    const source = data(file);
    if (!Array.isArray(source)) throw new Error(`Missing IndexNow source: ${file}`);
    const items = (source as Announcement[]).filter((item) => item.category === category &&
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(item.id));
    const visible = items.map((item) => visibleAnnouncement({
      ...item, aiSummary: getMatchingAnnouncementAiSummary(item, aiData?.items ?? {}) ?? item.aiSummary,
    }));
    contentByRoute[COLLECTIONS[category as keyof typeof COLLECTIONS]] = visible;
    allAnnouncements.push(...visible);
    for (const item of visible) put(`/announcements/${category}/${encodeURIComponent(item.id)}`, item);
  }
  contentByRoute["/announcements"] = allAnnouncements;
  contentByRoute["/academic/competitions"] = Object.entries({
    event: "announcements-events.json", department: "announcements-departments.json",
    academic: SOURCES.academic, campus: SOURCES.campus, scholarship: SOURCES.scholarship,
  }).flatMap(([category, file]) => {
    const source = data(file);
    if (!Array.isArray(source)) throw new Error(`Missing IndexNow source: ${file}`);
    return source.flatMap((item, index) => {
      const candidate = toCompetitionCandidate(item, category as CompetitionSourceCategory, index);
      if (!candidate) return [];
      const withAi = { ...candidate, aiSummary: getMatchingAnnouncementAiSummary(candidate, aiData?.items ?? {}) ?? candidate.aiSummary };
      return getCompetitionMatch(withAi).length ? [visibleAnnouncement(withAi)] : [];
    });
  });
  const holidays = { data: data("public-holidays.json"), stale: files["public/data/public-holidays.json"]?.stale === true };
  contentByRoute["/campus/cafeteria"] = {
    data: data("cafeteria-menu.json"), stale: files["public/data/cafeteria-menu.json"]?.stale === true,
  };
  contentByRoute["/campus/bus-info"] = [data("shuttle-bus-schedule.json"), data("shuttle-special-periods.json"), holidays];
  contentByRoute["/academic/schedule"] = [data("schedules-major.json"), holidays];
  contentByRoute["/campus/phone"] = data("phone-numbers.json");
  contentByRoute["/campus/campus-tips"] = data("campus-tips.json");
  contentByRoute["/campus/library"] = (data("shuttle-special-periods.json") as ShuttleSpecialPeriods | null)?.semesterPeriods ?? null;
  contentByRoute["/academic/graduation"] = GRADUATION_FILES.map(data);
  const notices = Object.entries(files).filter(([file]) => /^public\/service-notices\/[0-9A-Za-z][0-9A-Za-z-]*\.md$/.test(file));
  contentByRoute["/service/notices"] = notices.map(([file, value]) => [file, value.hash]);
  for (const [file, value] of notices) put(`/service/notices/${file.split("/").at(-1)!.slice(0, -3)}`, value.hash);
  contentByRoute["/"] = [
    // The home page renders the latest twelve notices, not the historical archive.
    [...allAnnouncements].sort((a, b) => b.date.localeCompare(a.date, "en-US")).slice(0, 12),
    contentByRoute["/service/notices"], contentByRoute["/campus/cafeteria"],
    contentByRoute["/campus/bus-info"], contentByRoute["/academic/schedule"],
  ];
  for (const { route } of PUBLIC_ROUTES) put(route, contentByRoute[route] ?? null);
  return result;
}

export function changedIndexNowUrls(previous: IndexNowSnapshot, next: IndexNowSnapshot) {
  return [...new Set([...Object.keys(previous), ...Object.keys(next)])]
    .filter((url) => previous[url] !== next[url]).sort();
}

function semantic(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(semantic);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).filter(([key]) => !VOLATILE.has(key)).sort(([a], [b]) => a.localeCompare(b, "en-US"))
      .map(([key, item]) => [key, semantic(item)]),
  );
  return value;
}

function digest(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

function visibleAnnouncement<T extends Announcement>(item: T) {
  const ai = item.aiSummary;
  return { ...item, aiSummary: ai && {
    summary: ai.summary, target: ai.target, deadline: ai.deadline, requiredAction: ai.requiredAction,
    keywords: ai.keywords, importance: ai.importance, confidence: ai.confidence,
  } };
}

function isRouteCode(file: string, route: string) {
  // shortcut: Dependencies are explicit; extend this map when adding a page or source.
  if (file === "proxy.ts" || /^(next\.config\.|app\/(layout\.|globals\.|providers\.|components\/|fonts\/)|lib\/(i18n|utils|korea-time|structured-data|public-routes|push-notifications|firebase)(\.|\/))/.test(file)) return true;
  if (ROUTE_CODE[route]?.some((prefix) => file.startsWith(prefix))) return true;
  const parts = route === "/" ? [] : route.slice(1).split("/");
  const directory = `app/${parts.join("/")}`;
  const nestedRoute = PUBLIC_ROUTES.some(({ route: other }) => other !== route && other.startsWith(`${route}/`) && file.startsWith(`app${other}/`));
  const detailChild = route === "/announcements" && file.startsWith("app/announcements/[category]/");
  if (file.startsWith(`${directory}/`) && parts.length > 0 && !nestedRoute && !detailChild) return true;
  if (parts.length === 0 && /^app\/page\./.test(file)) return true;
  if (parts.some((_, index) => file.startsWith(`app/${parts.slice(0, index + 1).join("/")}/layout.`))) return true;
  const feature = route === "/" ? "home" : route === "/campus/bus-info" ? "shuttle" : ["/academic", "/campus"].includes(route) ? undefined : parts.at(-1);
  if (feature && file.startsWith(`app/features/${feature}/`)) return true;
  if (route.startsWith("/announcements") || Object.values(COLLECTIONS).includes(route as typeof COLLECTIONS[keyof typeof COLLECTIONS]) || route === "/") {
    if (/^(lib\/(server\/announcement|announcement-)|app\/features\/announcements\/)/.test(file)) return true;
  }
  const announcementList = route === "/announcements" || Object.values(COLLECTIONS).includes(route as typeof COLLECTIONS[keyof typeof COLLECTIONS]);
  if ((announcementList || route === "/academic/competitions") && /^lib\/use-(debounced-value|url-search)\./.test(file)) return true;
  const dataRoute = ["/", "/announcements", ...Object.values(COLLECTIONS), "/academic/competitions", "/academic/schedule", "/campus/bus-info", "/campus/cafeteria", "/campus/phone", "/campus/library", "/campus/campus-tips"].includes(route);
  if (dataRoute && /^lib\/(api\.|fetch-json)/.test(file)) return true;
  if ((dataRoute || route.startsWith("/announcements/")) && /^(lib\/(server\/(crawl-data|home-data|read-response-bytes)|crawl-data-contract)|app\/api\/crawl-data\/)/.test(file)) return true;
  if ((announcementList || route === "/") && /^app\/api\/announcements\//.test(file)) return true;
  if (route === "/academic/competitions" && /^lib\/server\/announcement-ai\./.test(file)) return true;
  if (["/", "/campus/bus-info", "/campus/cafeteria"].includes(route) && /^lib\/(cafeteria|shuttle)/.test(file)) return true;
  if (["/", "/academic/schedule", "/academic/graduation", "/campus/bus-info", "/campus/cafeteria", "/campus/library", "/campus/phone"].includes(route) && /^lib\/(home|public-holidays)/.test(file)) return true;
  if (["/academic/schedule", "/academic/graduation", "/campus/phone"].includes(route) && /^lib\/academic-aeo/.test(file)) return true;
  if ((route === "/" || route.startsWith("/service/notices")) && /^lib\/serviceNotices/.test(file)) return true;
  return false;
}
