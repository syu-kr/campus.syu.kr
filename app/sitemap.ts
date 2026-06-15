import type { MetadataRoute } from "next";
import { getAllServiceNotices } from "@/lib/serviceNotices";
import { localizePath } from "@/lib/i18n";

const BASE_URL = "https://campus.syu.kr";

const PUBLIC_ROUTES = [
  { route: "/", changeFrequency: "daily", priority: 1 },
  { route: "/announcements", changeFrequency: "daily", priority: 0.95 },
  { route: "/academic", changeFrequency: "weekly", priority: 0.95 },
  {
    route: "/academic/announcements",
    changeFrequency: "daily",
    priority: 0.95,
  },
  { route: "/academic/schedule", changeFrequency: "weekly", priority: 0.9 },
  { route: "/academic/timetable", changeFrequency: "monthly", priority: 0.85 },
  { route: "/academic/graduation", changeFrequency: "monthly", priority: 0.85 },
  { route: "/academic/scholarship", changeFrequency: "weekly", priority: 0.85 },
  { route: "/campus", changeFrequency: "weekly", priority: 0.95 },
  {
    route: "/campus/announcements",
    changeFrequency: "daily",
    priority: 0.9,
  },
  { route: "/campus/bus-info", changeFrequency: "hourly", priority: 0.95 },
  { route: "/campus/cafeteria", changeFrequency: "daily", priority: 0.9 },
  { route: "/campus/library", changeFrequency: "hourly", priority: 0.9 },
  { route: "/campus/map", changeFrequency: "monthly", priority: 0.85 },
  { route: "/campus/phone", changeFrequency: "monthly", priority: 0.8 },
  { route: "/campus/campus-tips", changeFrequency: "weekly", priority: 0.8 },
  { route: "/campus/gym", changeFrequency: "weekly", priority: 0.8 },
  {
    route: "/campus/health-center",
    changeFrequency: "weekly",
    priority: 0.8,
  },
  { route: "/more", changeFrequency: "weekly", priority: 0.8 },
  { route: "/more/meet", changeFrequency: "monthly", priority: 0.75 },
  { route: "/more/privacy", changeFrequency: "yearly", priority: 0.5 },
  { route: "/service/notices", changeFrequency: "monthly", priority: 0.7 },
  { route: "/privacy", changeFrequency: "yearly", priority: 0.6 },
  { route: "/terms", changeFrequency: "yearly", priority: 0.6 },
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const serviceNotices = await getAllServiceNotices();
  const staticRoutes: MetadataRoute.Sitemap = PUBLIC_ROUTES.map(
    ({ route, changeFrequency, priority }) => ({
      url: `${BASE_URL}${route}`,
      changeFrequency,
      priority,
    }),
  );

  const noticeRoutes: MetadataRoute.Sitemap = serviceNotices.map((notice) => ({
    url: `${BASE_URL}/service/notices/${notice.slug}`,
    lastModified: notice.date,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  const englishStaticRoutes: MetadataRoute.Sitemap = PUBLIC_ROUTES.map(
    ({ route, changeFrequency, priority }) => ({
      url: `${BASE_URL}${localizePath(route, "en")}`,
      changeFrequency,
      priority: priority * 0.9,
    }),
  );

  const englishNoticeRoutes: MetadataRoute.Sitemap = serviceNotices.map((notice) => ({
    url: `${BASE_URL}${localizePath(`/service/notices/${notice.slug}`, "en")}`,
    lastModified: notice.date,
    changeFrequency: "monthly",
    priority: 0.4,
  }));

  return [
    ...staticRoutes,
    ...englishStaticRoutes,
    ...noticeRoutes,
    ...englishNoticeRoutes,
  ];
}
