import { unstable_cache } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { randomUUID } from "node:crypto";
import { getAnnouncementSummary } from "./announcements";
import { firebasePublicDataStore, publicDataBucketName, publicDataFirebaseEnabled, type ActivePublicData } from "./public-data-storage";
import { getHomeAcademicSchedules, getHomeCafeteriaSnapshot, getHomePublicHolidays, getHomeShuttleBuses, getHomeShuttleSpecialPeriods } from "./home-data";
import { measureHomeTask, traceHomeData } from "./home-performance";

async function readActive() {
  type Confirmed = { active: ActivePublicData; checkedAt: number; readId: string };
  let missed = false;
  let refreshed: Promise<Confirmed> | undefined, readId: string | undefined;
  const refresh = () => {
    const checkedAt = Date.now();
    readId = randomUUID();
    const currentReadId = readId;
    refreshed = traceHomeData("home-manifest", async () => {
      const active = await measureHomeTask("manifest-source", () => firebasePublicDataStore().readActive(), () => true);
      if (!active) throw new Error("Public data has no active Firebase snapshot");
      return { active, checkedAt, readId: currentReadId };
    });
    return refreshed;
  };
  const read = unstable_cache(refresh, ["home-active-manifest-v2", publicDataBucketName()], { revalidate: 15 });
  return measureHomeTask("manifest-cache", async () => {
    const value = await read();
    missed = value.readId === readId;
    const age = Date.now() - value.checkedAt;
    // Background refresh may fail or keep serving stale data; enforce our own hard limit.
    if (age >= 0 && age < 30_000) return value.active;
    missed = true;
    return (await (refreshed ?? refresh())).active;
  }, () => missed);
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
