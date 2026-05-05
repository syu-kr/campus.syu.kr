import type { CafeteriaMenu, MenuItem } from "@/types";

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

