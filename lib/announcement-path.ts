import type { AnnouncementCategory } from "@/types";

export function getAnnouncementDetailPath(
  category: AnnouncementCategory,
  id: string,
) {
  return `/announcements/${category}/${encodeURIComponent(id)}`;
}
