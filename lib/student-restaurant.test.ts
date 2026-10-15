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

  it.each(["2026-02-30", "2026-10-1", "unknown", "2026-10-19"])("rejects impossible, malformed, or out of week date %s", (date) => {
    const value = menu(); value.days[0].date = date;
    expect(() => parseStudentRestaurantMenu(value)).toThrow();
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
