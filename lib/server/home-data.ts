import { readFile } from "fs/promises";
import path from "path";
import type {
  AcademicSchedule,
  CafeteriaMenu,
  PhoneNumber,
  ShuttleBusSchedule,
  ShuttleSpecialPeriods,
} from "@/types";

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
  const data = await readPublicData<
    Array<{ menus?: unknown[] }> | { menus?: unknown[] }
  >("cafeteria-menu.json", []);
  const cafeteriaData = Array.isArray(data) ? data[0] : data;
  const menuDays = Array.isArray(cafeteriaData?.menus)
    ? (cafeteriaData.menus as Array<{
        date: string;
        day: string;
        meals?: {
          breakfast?: string[];
          lunch?: string[] | { a_corner?: string[]; b_corner?: string[] };
          dinner?: string[];
        };
      }>)
    : [];

  return menuDays.map((menu, idx) => {
    const lunch: CafeteriaMenu["lunch"] = {};

    if (Array.isArray(menu.meals?.lunch)) {
      lunch.a = menu.meals.lunch.map((name) => ({ name }));
    } else if (menu.meals?.lunch && typeof menu.meals.lunch === "object") {
      const lunchSource = menu.meals.lunch;
      lunch.a = lunchSource.a_corner?.map((name) => ({ name })) ?? [];
      lunch.b = lunchSource.b_corner?.map((name) => ({ name })) ?? [];
    }

    return {
      id: `cafeteria-${menu.date}-${idx}`,
      date: menu.date,
      dayOfWeek: menu.day || "",
      breakfast: menu.meals?.breakfast?.map((name) => ({ name })) ?? [],
      lunch,
      dinner: menu.meals?.dinner?.map((name) => ({ name })) ?? [],
      location: "SU-Lounge",
    };
  });
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
    vacationPeriods: [],
  });
}
