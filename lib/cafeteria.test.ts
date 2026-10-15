import { describe, expect, it } from "vitest";
import { getCafeteriaWeekMenus } from "./cafeteria";
import { getTodayInfo } from "./home";

describe("current cafeteria week", () => {
  const menus = ["2026-10-19", "2026-10-11", "2026-10-18", "2026-10-12", "2026-10-15"]
    .map((date) => ({ date, menu: date }));

  it.each(["2026-10-12", "2026-10-15", "2026-10-18"])("shows Monday through Sunday only for %s", (today) => {
    expect(getCafeteriaWeekMenus(menus, today).map(({ date }) => date))
      .toEqual(["2026-10-12", "2026-10-15", "2026-10-18"]);
    expect(menus[0].date).toBe("2026-10-19");
  });

  it("changes weeks at Korea's Monday midnight rather than UTC midnight", () => {
    const sunday = getTodayInfo(new Date("2026-10-18T14:59:59Z")).dateStringDash;
    const monday = getTodayInfo(new Date("2026-10-18T15:00:00Z")).dateStringDash;
    expect(getCafeteriaWeekMenus(menus, sunday).map(({ date }) => date))
      .toEqual(["2026-10-12", "2026-10-15", "2026-10-18"]);
    expect(getCafeteriaWeekMenus(menus, monday).map(({ date }) => date)).toEqual(["2026-10-19"]);
  });

  it("keeps one Monday-to-Sunday week across a year boundary", () => {
    const dates = ["2026-12-27", "2026-12-28", "2027-01-01", "2027-01-03", "2027-01-04"];
    expect(getCafeteriaWeekMenus(dates.map((date) => ({ date })), "2027-01-01").map(({ date }) => date))
      .toEqual(["2026-12-28", "2027-01-01", "2027-01-03"]);
  });

  it("handles absent menus or dates without selecting another week", () => {
    expect(getCafeteriaWeekMenus(undefined, "2026-10-15")).toEqual([]);
    expect(getCafeteriaWeekMenus(menus, "")).toEqual([]);
    expect(getCafeteriaWeekMenus(menus, "2026-10-26")).toEqual([]);
  });
});
