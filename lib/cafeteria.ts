import type { CafeteriaMenu, MenuItem } from "@/types";

export interface CafeteriaMenuDay {
  date: string;
  day: string;
  meals?: {
    breakfast?: string[];
    lunch?: string[] | { a_corner?: string[]; b_corner?: string[] };
    dinner?: string[];
  };
}

export function toCafeteriaMenus(days: CafeteriaMenuDay[]): CafeteriaMenu[] {
  return days.map((menu, index) => {
    const lunch: CafeteriaMenu["lunch"] = {};
    if (Array.isArray(menu.meals?.lunch)) {
      lunch.a = menu.meals.lunch.map((name) => ({ name }));
    } else if (menu.meals?.lunch && typeof menu.meals.lunch === "object") {
      lunch.a = (menu.meals.lunch.a_corner ?? []).map((name) => ({ name }));
      lunch.b = (menu.meals.lunch.b_corner ?? []).map((name) => ({ name }));
    }
    return {
      id: `cafeteria-${menu.date}-${index}`,
      date: menu.date,
      dayOfWeek: menu.day || "",
      breakfast: (menu.meals?.breakfast ?? []).map((name) => ({ name })),
      lunch,
      dinner: (menu.meals?.dinner ?? []).map((name) => ({ name })),
      location: "SU-Lounge",
    };
  });
}

const CLOSED_MEAL_LABELS = new Set([
  "운영없음",
  "운영 없음",
  "미운영",
  "휴무",
  "없음",
]);

function normalizeMealName(name: string) {
  return name.replace(/\s+/g, "");
}

export function isClosedMealItems(items?: MenuItem[]) {
  if (!items || items.length === 0) {
    return true;
  }

  return items.every((item) => CLOSED_MEAL_LABELS.has(normalizeMealName(item.name)));
}

export function isCafeteriaClosedDay(menu: CafeteriaMenu) {
  return (
    isClosedMealItems(menu.breakfast) &&
    isClosedMealItems(menu.lunch.a) &&
    isClosedMealItems(menu.lunch.b) &&
    isClosedMealItems(menu.dinner)
  );
}

function getLatestCafeteriaMenuDate(
  menus: CafeteriaMenu[] | undefined,
) {
  if (!menus || menus.length === 0) {
    return null;
  }

  return menus.reduce<string | null>((latest, menu) => {
    if (!menu.date) return latest;
    return !latest || menu.date > latest ? menu.date : latest;
  }, null);
}

export function isCafeteriaMenuDataStale(
  menus: CafeteriaMenu[] | undefined,
  todayDate: string,
) {
  const latestMenuDate = getLatestCafeteriaMenuDate(menus);
  return Boolean(latestMenuDate && latestMenuDate < todayDate);
}
