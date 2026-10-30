import { readPublicDataJson } from "./public-data";
import type { PublicDataFile } from "../public-data-snapshot";
import type {
  AcademicSchedule,
  PhoneNumber,
  ShuttleBusSchedule,
  ShuttleSpecialPeriods,
  PublicHolidaySnapshot,
} from "@/types";
import { readDailyCrawlDataSnapshot } from "./crawl-data";
import { unstable_rethrow } from "next/navigation";
import { readFirebasePublicData, type ActivePublicData } from "./public-data-storage";
import { emptyPublicHolidays, parsePublicHolidaySnapshot } from "../public-holidays";
import { toCafeteriaMenus, type CafeteriaMenuPayload, type CafeteriaSnapshot } from "../cafeteria";

export async function getHomePublicHolidays(active?: ActivePublicData): Promise<PublicHolidaySnapshot> {
  try {
    const snapshot = active ? {
      ...(await readFirebasePublicData<unknown>("public-holidays.json", active)),
      source: "firebase-storage", sourceHealth: active.manifest.sourceHealth["public-holidays.json"],
    } : await readDailyCrawlDataSnapshot<unknown>("public-holidays.json");
    return {
      ...parsePublicHolidaySnapshot(snapshot.data),
      stale: snapshot.source === "bundled-fallback" || snapshot.sourceHealth?.status === "stale",
    };
  } catch (error) {
    unstable_rethrow(error);
    if (active) throw error;
    return emptyPublicHolidays();
  }
}

async function readPublicData<T>(fileName: PublicDataFile, fallback: T, active?: ActivePublicData): Promise<T> {
  if (active) return (await readFirebasePublicData<T>(fileName, active)).data;
  try {
    return await readPublicDataJson<T>(fileName);
  } catch {
    return fallback;
  }
}

export async function getHomeCafeteriaSnapshot(active?: ActivePublicData): Promise<CafeteriaSnapshot> {
  const snapshot = active ? {
    ...(await readFirebasePublicData<CafeteriaMenuPayload>("cafeteria-menu.json", active)),
    source: "firebase-storage", sourceHealth: active.manifest.sourceHealth["cafeteria-menu.json"],
  } : await readDailyCrawlDataSnapshot<CafeteriaMenuPayload>("cafeteria-menu.json");
  const cafeteriaData = Array.isArray(snapshot.data) ? snapshot.data[0] : snapshot.data;
  const menuDays = Array.isArray(cafeteriaData?.menus)
    ? cafeteriaData.menus
    : [];

  return {
    menus: toCafeteriaMenus(menuDays),
    checkedAt: snapshot.source === "bundled-fallback" ? null : snapshot.sourceHealth?.lastSuccessAt ?? null,
    stale: snapshot.source === "bundled-fallback" || snapshot.sourceHealth?.status === "stale",
  };
}

export function getHomeAcademicSchedules(active?: ActivePublicData): Promise<AcademicSchedule[]> {
  return readPublicData<AcademicSchedule[]>("schedules-major.json", [], active);
}

export function getHomePhoneNumbers(): Promise<PhoneNumber[]> {
  return readPublicData<PhoneNumber[]>("phone-numbers.json", []);
}

export function getHomeShuttleBuses(active?: ActivePublicData): Promise<ShuttleBusSchedule[]> {
  return readPublicData<ShuttleBusSchedule[]>("shuttle-bus-schedule.json", [], active);
}

export function getHomeShuttleSpecialPeriods(active?: ActivePublicData): Promise<ShuttleSpecialPeriods> {
  return readPublicData<ShuttleSpecialPeriods>("shuttle-special-periods.json", {
    specialPeriods: [],
    semesterPeriods: [],
    vacationPeriods: [],
  }, active);
}
