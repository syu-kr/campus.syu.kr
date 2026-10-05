import { stripLocalePrefix } from "./i18n";

/** Use a known parent page even when the current page was opened directly. */
export function getParentPageHref(pathname: string | null): string | null {
  const path = stripLocalePrefix(pathname ?? "/").replace(/\/+$/, "") || "/";

  if (path === "/") return null;

  if (path === "/terms" || path === "/privacy" || path === "/service/notices") {
    return "/more";
  }
  if (path.startsWith("/service/notices/")) return "/service/notices";
  if (path.startsWith("/announcements/")) return "/announcements";

  if (path === "/campus/roommates/verify") return "/campus";
  if (path === "/campus/roommates/verify/finish") {
    return "/campus/roommates/verify";
  }
  if (path.startsWith("/campus/roommates/")) return "/campus/roommates";
  if (path === "/campus/campus-tips/suggest") return "/campus/campus-tips";
  if (path.startsWith("/more/meet/")) return "/more/meet";

  for (const section of ["/academic", "/campus", "/more"]) {
    if (path.startsWith(`${section}/`)) return section;
  }

  return "/";
}
