import { describe, expect, it } from "vitest";
import { parseStudentRestaurantMenu } from "./student-restaurant";

const menu = () => ({
  updatedAt: "2026-10-15T04:30:00Z", weekStart: "2026-10-12",
  days: [
    { date: "2026-10-13", breakfast: [], lunch: ["밥", "국"], dinner: null },
    { date: "2026-10-12", breakfast: ["죽"], lunch: [], dinner: null },
  ],
});

describe("Manna House public schema", () => {
  it("sorts only provided dates and preserves closed versus unknown meals", () => {
    const result = parseStudentRestaurantMenu(menu());
    expect(result.days.map((day) => day.date)).toEqual(["2026-10-12", "2026-10-13"]);
    expect(result.days[1]).toEqual(menu().days[0]);
    expect(Object.keys(result)).toEqual(["updatedAt", "weekStart", "days"]);
  });

  it.each(["apiUrl", "imageUrl", "uploadFileName", "source", "rawText", "imageHash"])("rejects private field %s", (field) => {
    expect(() => parseStudentRestaurantMenu({ ...menu(), [field]: "private" })).toThrow();
  });

  it("preserves optional raw ingredient cells including duplicates and unavailable meals", () => {
    const ingredients = { breakfast: null, lunch: ["콩,밀/계란", "콩,밀/계란"], dinner: [] };
    const value = { ...menu(), days: [{ ...menu().days[0], ingredients }] };
    expect(parseStudentRestaurantMenu(value).days[0].ingredients).toEqual(ingredients);
    expect(parseStudentRestaurantMenu(menu()).days[0]).not.toHaveProperty("ingredients");
  });

  it.each([
    null,
    { breakfast: null, lunch: [], dinner: null, imageUrl: "private" },
    { breakfast: null, lunch: ["https://private.invalid"], dinner: null },
    { breakfast: null, lunch: [], dinner: "milk" },
    { breakfast: null, lunch: [] },
  ])("rejects malformed or private ingredients", (ingredients) => {
    expect(() => parseStudentRestaurantMenu({ ...menu(), days: [{ ...menu().days[0], ingredients }] })).toThrow();
  });

  it("accepts both consecutive weeks including the last Sunday without exposing extra metadata", () => {
    const value = menu();
    value.days = Array.from({ length: 14 }, (_, offset) => ({
      ...value.days[0], date: new Date(Date.UTC(2026, 9, 12 + offset)).toISOString().slice(0, 10),
    }));
    const result = parseStudentRestaurantMenu(value);
    expect(result.days).toHaveLength(14);
    expect(result.days[7].date).toBe("2026-10-19");
    expect(result.days[13].date).toBe("2026-10-25");
    expect(Object.keys(result)).toEqual(["updatedAt", "weekStart", "days"]);
  });

  it.each(["2026-02-30", "2026-10-1", "unknown", "2026-10-11", "2026-10-26"])("rejects impossible, malformed, or out of two-week date %s", (date) => {
    const value = menu(); value.days[0].date = date;
    expect(() => parseStudentRestaurantMenu(value)).toThrow();
  });

  it("rejects more than fourteen days", () => {
    expect(() => parseStudentRestaurantMenu({ ...menu(), days: Array.from({ length: 15 }, () => menu().days[0]) })).toThrow();
  });

  it("rejects duplicate dates, non-Monday week start, invalid timestamps and invalid meals", () => {
    const value = menu(); value.days[0].date = value.days[1].date;
    expect(() => parseStudentRestaurantMenu(value)).toThrow();
    expect(() => parseStudentRestaurantMenu({ ...menu(), weekStart: "2026-10-13" })).toThrow();
    expect(() => parseStudentRestaurantMenu({ ...menu(), updatedAt: "2026-02-30T00:00:00Z" })).toThrow();
    expect(() => parseStudentRestaurantMenu({ ...menu(), days: [{ ...menu().days[0], lunch: "밥" }] })).toThrow();
    expect(() => parseStudentRestaurantMenu({ ...menu(), days: [{ ...menu().days[0], lunch: ["https://private.invalid/menu"] }] })).toThrow();
    expect(() => parseStudentRestaurantMenu({ ...menu(), days: [{ ...menu().days[0], lunch: [""] }] })).toThrow();
  });
});
