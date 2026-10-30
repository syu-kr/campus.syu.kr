import { unstable_cache } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { getAnnouncementSummary } from "./announcements";
import { getActivePublicData, publicDataFirebaseEnabled, type ActivePublicData } from "./public-data-storage";
import { measureHomeTask } from "./home-performance";

// The immutable manifest is part of the key; check the active version before every lookup.
const readCachedSummary = unstable_cache(
  (active: ActivePublicData) => measureHomeTask("announcement-summary-build", () => getAnnouncementSummary(12, active)),
  ["home-announcement-summary-v1"],
  { revalidate: false },
);

export async function getHomeAnnouncementSummary() {
  if (publicDataFirebaseEnabled()) {
    try {
      const active = await getActivePublicData();
      return await measureHomeTask("announcement-summary-cache", () => readCachedSummary(active));
    } catch (error) { unstable_rethrow(error); }
  }
  // Failed or bundled fallback results must not enter the shared version cache.
  // shortcut: A failed fill retries the legacy reader; share failed reads if outage latency warrants it.
  return getAnnouncementSummary(12);
}
