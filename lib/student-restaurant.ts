interface StudentRestaurantDay {
  date: string;
  breakfast: string[] | null;
  lunch: string[] | null;
  dinner: string[] | null;
}

export interface StudentRestaurantMenu {
  updatedAt: string;
  weekStart: string;
  days: StudentRestaurantDay[];
}

export function parseStudentRestaurantPublicUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || !/^[a-z0-9.-]+$/i.test(url.hostname) || url.username || url.password || url.search || url.hash ||
    !url.pathname.endsWith("/cafeteria/student-restaurant-1.json")) {
    throw new Error("Invalid public cafeteria JSON URL");
  }
  return url;
}

function invalid(): never {
  throw new Error("Invalid student restaurant menu");
}

function exactObject(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const object = value as Record<string, unknown>;
  if (Object.keys(object).length !== keys.length || keys.some((key) => !Object.hasOwn(object, key))) invalid();
  return object;
}

function dateValue(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid();
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) invalid();
  return value;
}

function mealValue(value: unknown): string[] | null {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length > 40) invalid();
  return value.map((name: unknown) => {
    if (typeof name !== "string" || !name.trim() || name.length > 160 ||
      /[\u0000-\u001f\u007f]|https?:|www\.|data:|sk-[a-z0-9]/i.test(name)) invalid();
    return name;
  });
}

// Shared trust boundary for AI output, Pages publication, and the browser.
export function parseStudentRestaurantMenu(value: unknown): StudentRestaurantMenu {
  const object = exactObject(value, ["updatedAt", "weekStart", "days"]);
  if (typeof object.updatedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(object.updatedAt) ||
    !Number.isFinite(Date.parse(object.updatedAt)) ||
    new Date(object.updatedAt).toISOString().replace(".000Z", "Z") !== object.updatedAt.replace(".000Z", "Z")) invalid();
  const weekStart = dateValue(object.weekStart);
  const start = Date.parse(`${weekStart}T00:00:00Z`);
  if (new Date(start).getUTCDay() !== 1 || !Array.isArray(object.days) || object.days.length > 7) invalid();
  const dates = new Set<string>();
  const days = object.days.map((value: unknown) => {
    const day = exactObject(value, ["date", "breakfast", "lunch", "dinner"]);
    const date = dateValue(day.date);
    const time = Date.parse(`${date}T00:00:00Z`);
    if (dates.has(date) || time < start || time >= start + 7 * 86_400_000) invalid();
    dates.add(date);
    return { date, breakfast: mealValue(day.breakfast), lunch: mealValue(day.lunch), dinner: mealValue(day.dinner) };
  }).sort((a, b) => a.date.localeCompare(b.date));
  return { updatedAt: object.updatedAt, weekStart, days };
}
