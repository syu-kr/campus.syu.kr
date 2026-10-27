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
import { emptyPublicHolidays, parsePublicHolidaySnapshot } from "../public-holidays";
import { toCafeteriaMenus, type CafeteriaMenuPayload, type CafeteriaSnapshot } from "../cafeteria";

export async function getHomePublicHolidays(): Promise<PublicHolidaySnapshot> {
  try {
    const snapshot = await readDailyCrawlDataSnapshot<unknown>("public-holidays.json");
    return {
      ...parsePublicHolidaySnapshot(snapshot.data),
      stale: snapshot.source === "bundled-fallback" || snapshot.sourceHealth?.status === "stale",
    };
  } catch (error) {
    unstable_rethrow(error);
    return emptyPublicHolidays();
  }
}

async function readPublicData<T>(fileName: PublicDataFile, fallback: T): Promise<T> {
  try {
    return await readPublicDataJson<T>(fileName);
  } catch {
    return fallback;
  }
}

export async function getHomeCafeteriaSnapshot(): Promise<CafeteriaSnapshot> {
  const snapshot = await readDailyCrawlDataSnapshot<CafeteriaMenuPayload>("cafeteria-menu.json");
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

export function getHomeAcademicSchedules(): Promise<AcademicSchedule[]> {
  return readPublicData<AcademicSchedule[]>("schedules-major.json", []);
}

export function getHomePhoneNumbers(): Promise<PhoneNumber[]> {
  return readPublicData<PhoneNumber[]>("phone-numbers.json", []);
}

export function getHomeShuttleBuses(): Promise<ShuttleBusSchedule[]> {
  return readPublicData<ShuttleBusSchedule[]>("shuttle-bus-schedule.json", []);
}

export function getHomeShuttleSpecialPeriods(): Promise<ShuttleSpecialPeriods> {
  return readPublicData<ShuttleSpecialPeriods>("shuttle-special-periods.json", {
    specialPeriods: [],
    semesterPeriods: [],
    vacationPeriods: [],
  });
}
