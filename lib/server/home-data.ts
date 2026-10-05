import { readFile } from "fs/promises";
import path from "path";
import type {
  AcademicSchedule,
  CafeteriaMenu,
  PhoneNumber,
  ShuttleBusSchedule,
  ShuttleSpecialPeriods,
  PublicHolidaySnapshot,
} from "@/types";
import { readDailyCrawlDataJson, readDailyCrawlDataSnapshot } from "./crawl-data";
import { unstable_rethrow } from "next/navigation";
import { emptyPublicHolidays, parsePublicHolidaySnapshot } from "../public-holidays";
import { toCafeteriaMenus, type CafeteriaMenuDay } from "../cafeteria";

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

async function readPublicData<T>(fileName: string, fallback: T): Promise<T> {
  try {
    const filePath = path.join(process.cwd(), "public", "data", fileName);
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

export async function getHomeCafeteriaMenus(): Promise<CafeteriaMenu[]> {
  const data = await readDailyCrawlDataJson<
    Array<{ menus?: CafeteriaMenuDay[] }> | { menus?: CafeteriaMenuDay[] }
  >("cafeteria-menu.json");
  const cafeteriaData = Array.isArray(data) ? data[0] : data;
  const menuDays = Array.isArray(cafeteriaData?.menus)
    ? cafeteriaData.menus
    : [];

  return toCafeteriaMenus(menuDays);
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
