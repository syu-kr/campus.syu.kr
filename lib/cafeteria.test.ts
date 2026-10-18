import { describe, expect, it } from "vitest";
import { getCafeteriaWeekMenus } from "./cafeteria";
import { getTodayInfo } from "./home";

describe("cafeteria display week", () => {
  const menus = ["2026-10-19", "2026-10-11", "2026-10-18", "2026-10-12", "2026-10-15"]
    .map((date) => ({ date, menu: date }));

  it.each(["2026-10-12", "2026-10-15", "2026-10-16"])("keeps this week on weekdays for %s", (today) => {
    expect(getCafeteriaWeekMenus(menus, today).map(({ date }) => date))
      .toEqual(["2026-10-12", "2026-10-15", "2026-10-18"]);
    expect(menus[0].date).toBe("2026-10-19");
  });

  it.each(["2026-10-17", "2026-10-18"])("prefers the immediately following week on weekend %s", (today) => {
    expect(getCafeteriaWeekMenus(menus, today).map(({ date }) => date)).toEqual(["2026-10-19"]);
    expect(getCafeteriaWeekMenus([{ date: "2026-10-19" }], today)).toEqual([{ date: "2026-10-19" }]);
  });

  it.each(["2026-10-17", "2026-10-18"])("keeps this week when the next week is absent on %s", (today) => {
    expect(getCafeteriaWeekMenus(menus.filter(({ date }) => date !== "2026-10-19"), today).map(({ date }) => date))
      .toEqual(["2026-10-12", "2026-10-15", "2026-10-18"]);
  });

  it("switches to weekend preview at Korea's Saturday midnight rather than UTC midnight", () => {
    const friday = getTodayInfo(new Date("2026-10-16T14:59:59Z")).dateStringDash;
    const saturday = getTodayInfo(new Date("2026-10-16T15:00:00Z")).dateStringDash;
    expect(getCafeteriaWeekMenus(menus, friday).map(({ date }) => date))
      .toEqual(["2026-10-12", "2026-10-15", "2026-10-18"]);
    expect(getCafeteriaWeekMenus(menus, saturday).map(({ date }) => date)).toEqual(["2026-10-19"]);
  });

  it("keeps one Monday-to-Sunday week across a year boundary", () => {
    const dates = ["2026-12-27", "2026-12-28", "2027-01-01", "2027-01-03", "2027-01-04"];
    expect(getCafeteriaWeekMenus(dates.map((date) => ({ date })), "2027-01-01").map(({ date }) => date))
      .toEqual(["2026-12-28", "2027-01-01", "2027-01-03"]);
  });

  it("previews the next week across a year boundary without including either adjacent week", () => {
    const dates = ["2026-12-27", "2026-12-28", "2027-01-01", "2027-01-03", "2027-01-04"];
    expect(getCafeteriaWeekMenus(dates.map((date) => ({ date })), "2026-12-27").map(({ date }) => date))
      .toEqual(["2026-12-28", "2027-01-01", "2027-01-03"]);
  });

  it("does not preview a week farther away than next week", () => {
    expect(getCafeteriaWeekMenus([{ date: "2026-10-26" }], "2026-10-18")).toEqual([]);
    expect(getCafeteriaWeekMenus([{ date: "2026-10-12" }, { date: "2026-10-26" }], "2026-10-18"))
      .toEqual([{ date: "2026-10-12" }]);
  });

  it("handles absent menus or dates without selecting another week", () => {
    expect(getCafeteriaWeekMenus(undefined, "2026-10-15")).toEqual([]);
    expect(getCafeteriaWeekMenus(menus, "")).toEqual([]);
    expect(getCafeteriaWeekMenus(menus, "2026-10-26")).toEqual([]);
  });
});
