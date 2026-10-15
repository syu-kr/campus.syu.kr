import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES } from "@/lib/public-routes";
import { getAllServiceNotices } from "@/lib/serviceNotices";
import { localizePath } from "@/lib/i18n";
import { getAnnouncementDetailPath } from "@/lib/announcement-path";
import { getAnnouncementSitemapItems } from "@/lib/server/announcements";

export const dynamic = "force-dynamic";

const BASE_URL = "https://campus.syu.kr";

type PublicRoute = (typeof PUBLIC_ROUTES)[number];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [serviceNotices, announcements] = await Promise.all([
    getAllServiceNotices(),
    getAnnouncementSitemapItems(),
  ]);
  const staticRoutes: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((route) =>
    createSitemapEntry(route, "ko"),
  );

  const noticeRoutes: MetadataRoute.Sitemap = serviceNotices.map((notice) => ({
    url: `${BASE_URL}/service/notices/${notice.slug}`,
    lastModified: notice.date,
    changeFrequency: "monthly",
    priority: 0.5,
    alternates: createAlternates(`/service/notices/${notice.slug}`),
  }));

  const englishStaticRoutes: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((route) =>
    createSitemapEntry(route, "en"),
  );

  const englishNoticeRoutes: MetadataRoute.Sitemap = serviceNotices.map(
    (notice) => ({
      url: `${BASE_URL}${localizePath(`/service/notices/${notice.slug}`, "en")}`,
      lastModified: notice.date,
      changeFrequency: "monthly",
      priority: 0.4,
      alternates: createAlternates(`/service/notices/${notice.slug}`),
    }),
  );

  const announcementRoutes: MetadataRoute.Sitemap = announcements.flatMap(
    ({ category, id }) => {
      const route = getAnnouncementDetailPath(category, id);
      return (["ko", "en"] as const).map((locale) => ({
        url: `${BASE_URL}${localizePath(route, locale)}`,
        changeFrequency: "daily" as const,
        priority: locale === "ko" ? 0.7 : 0.6,
        alternates: createAlternates(route),
      }));
    },
  );

  return [
    ...staticRoutes,
    ...englishStaticRoutes,
    ...noticeRoutes,
    ...englishNoticeRoutes,
    ...announcementRoutes,
  ];
}

function createSitemapEntry(
  { route, changeFrequency, priority }: PublicRoute,
  locale: "ko" | "en",
): MetadataRoute.Sitemap[number] {
  return {
    url: `${BASE_URL}${locale === "en" ? localizePath(route, "en") : route}`,
    changeFrequency,
    priority: locale === "en" ? priority * 0.9 : priority,
    alternates: createAlternates(route),
  };
}

function createAlternates(route: string): MetadataRoute.Sitemap[number]["alternates"] {
  return {
    languages: {
      ko: `${BASE_URL}${route}`,
      en: `${BASE_URL}${localizePath(route, "en")}`,
      "x-default": `${BASE_URL}${route}`,
    },
  };
}
