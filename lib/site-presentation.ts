import { stripLocalePrefix } from "./i18n/routing";

export function getSiteSection(pathname: string): "/" | "/academic" | "/campus" | "/more" {
  const path = stripLocalePrefix(pathname);
  if (path === "/") return "/";
  if (path.startsWith("/campus") || path.startsWith("/announcements/campus/")) return "/campus";
  if (path.startsWith("/academic") || path.startsWith("/announcements")) return "/academic";
  return "/more";
}

export function getSitePresentationRoute(pathname: string): string {
  const path = stripLocalePrefix(pathname).replace(/\/+$/, "") || "/";
  if (/^\/announcements\/[^/]+\/[^/]+$/.test(path)) return "/announcements/[category]/[id]";
  if (/^\/service\/notices\/[^/]+$/.test(path)) return "/service/notices/[slug]";
  if (/^\/more\/meet\/[^/]+$/.test(path)) return "/more/meet/[roomId]";
  if (/^\/campus\/roommates\/[^/]+$/.test(path) && !["new", "me", "verify"].includes(path.split("/").at(-1)!)) return "/campus/roommates/[postId]";
  return path;
}
