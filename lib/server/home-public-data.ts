import { unstable_cache } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { getAnnouncementSummary } from "./announcements";
import { firebasePublicDataStore, publicDataBucketName, publicDataFirebaseEnabled, type ActivePublicData } from "./public-data-storage";
import { getHomeAcademicSchedules, getHomeCafeteriaSnapshot, getHomePublicHolidays, getHomeShuttleBuses, getHomeShuttleSpecialPeriods } from "./home-data";
import { measureHomeTask } from "./home-performance";

async function readActive() {
  let missed = false;
  const read = unstable_cache(async () => {
    missed = true;
    const active = await measureHomeTask("manifest-source-rest", () => firebasePublicDataStore(true).readActive());
    if (!active) throw new Error("Public data has no active Firebase snapshot");
    return active;
  }, ["home-active-manifest-v1", publicDataBucketName(), String(Math.floor(Date.now() / 30_000))], { revalidate: false });
  // A new key at each boundary avoids stale-while-revalidate and stacked TTLs.
  return measureHomeTask("manifest-cache", () => read(), () => missed);
}

async function readHomeData(active?: ActivePublicData) {
  const [initialAnnouncements, initialSchedules, initialPublicHolidays, cafeteria, shuttles, specialPeriods] = await Promise.all([
    measureHomeTask("announcements", () => getAnnouncementSummary(12, active)),
    measureHomeTask("schedules", () => getHomeAcademicSchedules(active)),
    measureHomeTask("holidays", () => getHomePublicHolidays(active)),
    measureHomeTask("cafeteria", async () => {
      try { return await getHomeCafeteriaSnapshot(active); }
      catch (error) { unstable_rethrow(error); if (active) throw error; return undefined; }
    }),
    measureHomeTask("shuttles", () => getHomeShuttleBuses(active)),
    measureHomeTask("special-periods", () => getHomeShuttleSpecialPeriods(active)),
  ]);
  return { initialAnnouncements, initialSchedules, initialPublicHolidays,
    initialOverviewData: { cafeteria, shuttles, specialPeriods, firebaseDataEnabled: publicDataFirebaseEnabled() } };
}

export async function getHomePublicData() {
  if (publicDataFirebaseEnabled()) {
    try {
      const active = await readActive();
      let missed = false;
      const read = unstable_cache((snapshot: ActivePublicData) => {
        missed = true;
        return measureHomeTask("home-snapshot-build", () => readHomeData(snapshot));
      }, ["home-public-snapshot-v1"], { revalidate: false });
      return await measureHomeTask("home-snapshot-cache", () => read(active), () => missed);
    } catch (error) { unstable_rethrow(error); }
  }
  // Keep bundled recovery and its stale flags outside the shared cache.
  return readHomeData();
}
