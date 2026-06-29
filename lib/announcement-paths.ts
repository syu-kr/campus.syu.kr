import type { Announcement } from "@/types";

export function getAnnouncementDetailPath(
  announcement: Pick<Announcement, "category" | "id">,
) {
  return `/announcements/${announcement.category}/${encodeURIComponent(
    announcement.id,
  )}`;
}
