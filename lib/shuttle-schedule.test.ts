import { describe, expect, it } from "vitest";

import {
  applyShuttleSpecialPeriods,
  getCurrentShuttleSummary,
  getShuttleDayStatus,
  getShuttleAdditionalServiceBuses,
  timeToMinutes,
} from "./shuttle-schedule";
import buses from "@/public/data/shuttle-bus-schedule.json";
import periods from "@/public/data/shuttle-special-periods.json";
import type { ShuttleSpecialPeriods } from "@/types";
import type { PublicHolidaySnapshot } from "@/types/public-holidays";
import { PUBLIC_HOLIDAY_SOURCE_URL } from "./public-holidays";

const specialPeriods = periods as ShuttleSpecialPeriods;

function summarize(dateTime: string) {
  return getCurrentShuttleSummary({
    buses,
    specialPeriods,
    now: new Date(dateTime),
    holidays: {
      schemaVersion: 1, sourceUrl: PUBLIC_HOLIDAY_SOURCE_URL,
      years: [2026], holidays: [], lastSuccessAt: dateTime,
    },
  });
}

describe("timeToMinutes", () => {
  it("parses valid times and rejects invalid ranges", () => {
    expect(timeToMinutes("08:05")).toBe(485);
    expect(timeToMinutes("24:00")).toBeNull();
    expect(timeToMinutes("08:60")).toBeNull();
    expect(timeToMinutes("invalid")).toBeNull();
  });
});

describe("public holiday shuttle operation", () => {
  const now = new Date("2026-10-09T11:55:00+09:00");
  const holidays: PublicHolidaySnapshot = {
    schemaVersion: 1, sourceUrl: PUBLIC_HOLIDAY_SOURCE_URL, years: [2026],
    holidays: [{ date: "2026-10-09", names: ["한글날"] }],
    lastSuccessAt: "2026-10-09T00:00:00+09:00",
  };
  const summarizeWith = (options: {
    holidays?: PublicHolidaySnapshot; specialPeriods?: ShuttleSpecialPeriods; now?: Date;
  } = {}) => getCurrentShuttleSummary({ buses, specialPeriods, holidays, now, ...options });

  it("preserves predictions on a covered ordinary day", () => {
    const summary = summarizeWith({ now: new Date("2026-10-09T11:55:00+09:00"),
      holidays: { ...holidays, holidays: [] } });
    expect(summary.operationStatus).toBe("regular");
    expect(summary.departures.length).toBeGreaterThan(0);
  });

  it.each([
    ["unknown year", { ...holidays, years: [2025], holidays: [] }],
    ["stale non-holiday", { ...holidays, holidays: [], lastSuccessAt: "2026-09-01T00:00:00Z" }],
    ["missing snapshot", undefined],
  ])("suppresses departures and add/replace services for %s", (_, snapshot) => {
    const summary = summarizeWith({ holidays: snapshot as PublicHolidaySnapshot | undefined,
      specialPeriods: { ...specialPeriods, specialPeriods: [{
        ...specialPeriods.specialPeriods[0], applicableDates: ["2026-10-09"],
        routes: ["all"], addedTimes: ["12:00"],
      }] },
    });
    expect(summary.operationStatus).toBe("unconfirmed");
    expect(summary.departures).toEqual([]);
    expect(summary.additionalServicePeriods).toEqual([]);
    expect(summary.hasMoreToday).toBe(false);
  });

  it.each([false, true])("closes a confirmed holiday even when stale=%s", (stale) => {
    const summary = summarizeWith({ holidays: { ...holidays, stale } });
    expect(summary.operationStatus).toBe("closed");
    expect(summary.holiday.names).toEqual(["한글날"]);
    expect(summary.departures).toEqual([]);
    expect(summary.additionalServicePeriods).toEqual([]);
  });

  it("closes the substitute holiday and weekends using the Korean date", () => {
    expect(getShuttleDayStatus({ dateString: "2026-10-05", now,
      holidays: { ...holidays, holidays: [{ date: "2026-10-05", names: ["대체공휴일(개천절)"] }] },
    }).operationStatus).toBe("closed");
    const summary = summarizeWith({ now: new Date("2027-01-01T15:01:00Z"), holidays: undefined });
    expect(summary.operationStatus).toBe("closed");
    expect(summary.isWeekend).toBe(true);
    expect(summary.departures).toEqual([]);
  });

  it("honors only verified route-specific service, including weekends outside operating periods", () => {
    const summary = summarizeWith({ now: new Date("2027-01-02T11:55:00+09:00"),
      specialPeriods: { ...specialPeriods, serviceExceptions: [{
        date: "2027-01-02", routeId: "shuttle-1", times: ["12:15"],
        sourceUrl: "https://www.syu.ac.kr/school-life/school-bus/", verifiedAt: "2026-10-09",
      }] },
    });
    expect(summary.operationStatus).toBe("exception");
    expect(summary.isWeekend).toBe(false);
    expect(summary.isOperatingPeriod).toBe(true);
    expect(summary.departures).toEqual([{ routeName: buses[1].routeName,
      time: "12:15", minutesUntil: 20 }]);
  });

  it("requires a valid source, verification time and departure times for exceptions", () => {
    const exception = { date: "2026-10-09", routeId: "shuttle-1", times: ["12:15"],
      sourceUrl: "https://www.syu.ac.kr/school-life/school-bus/", verifiedAt: "2026-10-08" };
    for (const record of [
      { ...exception, sourceUrl: "" }, { ...exception, verifiedAt: "2026-10-10" },
      { ...exception, times: ["24:00"] },
    ]) {
      expect(summarizeWith({ specialPeriods: { ...specialPeriods, serviceExceptions: [record] } })
        .operationStatus).toBe("closed");
    }
  });

  it("applies a verified closure and lets a verified exception override that date", () => {
    const overrides: ShuttleSpecialPeriods = { ...specialPeriods, closedDates: [{
      date: "2026-10-09", sourceUrl: "https://www.syu.ac.kr/school-life/school-bus/", verifiedAt: "2026-10-08",
    }] };
    expect(summarizeWith({ specialPeriods: overrides }).operationStatus).toBe("closed");
    const exception = { date: "2026-10-09", routeId: "shuttle-1", times: ["12:15"],
      sourceUrl: "https://www.syu.ac.kr/school-life/school-bus/", verifiedAt: "2026-10-08" };
    expect(summarizeWith({ specialPeriods: { ...overrides, serviceExceptions: [exception] } })
      .operationStatus).toBe("exception");
  });

});

describe("fall midterm shuttle extensions", () => {
  it.each(["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-26"])(
    "includes both added departures only for Seokgye on %s and ends after the last departure",
    (date) => {
      for (const [time, nextTime] of [["18:35", "18:40"], ["18:45", "19:00"]]) {
        const summary = summarize(`${date}T${time}:00+09:00`);
        expect(summary.isSpecialSchedule).toBe(true);
        expect(summary.departures).toEqual([
          { routeName: buses[1].routeName, time: nextTime, minutesUntil: time === "18:35" ? 5 : 15 },
        ]);
        expect(summary.hasMoreToday).toBe(true);
      }
      const ended = summarize(`${date}T19:01:00+09:00`);
      expect(ended.departures).toEqual([]);
      expect(ended.hasMoreToday).toBe(false);
    },
  );

  it.each(["2026-10-19", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-27"])(
    "does not extend service on the unannounced date %s",
    (date) => {
      const summary = summarize(`${date}T18:35:00+09:00`);
      expect(summary.isSpecialSchedule).toBe(false);
      expect(summary.departures).toEqual([]);
      expect(summary.hasMoreToday).toBe(false);
    },
  );
});

describe("fall online-class week shuttle", () => {
  it.each(["2026-10-28", "2026-10-29", "2026-10-30", "2026-11-02"])(
    "uses the reduced Hwarangdae and Seokgye departures while preserving Byeollae on %s",
    (date) => {
      const morning = summarize(`${date}T08:11:00+09:00`);
      expect(morning.isSpecialSchedule).toBe(true);
      expect(morning.departures).toContainEqual({
        routeName: buses[0].routeName, time: "08:20", minutesUntil: 9,
      });
      expect(morning.departures).toContainEqual({
        routeName: buses[2].routeName,
        time: date === "2026-10-30" ? "08:55" : "08:30",
        minutesUntil: date === "2026-10-30" ? 44 : 19,
      });
      expect(summarize(`${date}T10:01:00+09:00`).departures).toContainEqual({
        routeName: buses[0].routeName, time: "10:30", minutesUntil: 29,
      });
      expect(summarize(`${date}T12:01:00+09:00`).departures).toContainEqual({
        routeName: buses[1].routeName, time: "12:30", minutesUntil: 29,
      });
    },
  );

  it.each([
    ["2026-10-28", "17:30"],
    ["2026-10-30", "15:30"],
    ["2026-11-02", "17:30"],
  ])("ends Seokgye service at the announced last departure on %s", (date, lastTime) => {
    const lastDeparture = new Date(`${date}T${lastTime}:00+09:00`).getTime();
    expect(summarize(new Date(lastDeparture - 60_000).toISOString()).departures).toContainEqual({
      routeName: buses[1].routeName, time: lastTime, minutesUntil: 1,
    });
    const ended = summarize(new Date(lastDeparture + 60_000).toISOString());
    expect(ended.departures).toEqual([]);
    expect(ended.hasMoreToday).toBe(false);
  });

  it.each(["2026-10-27", "2026-11-03"])("keeps the ordinary timetable outside the announced dates: %s", (date) => {
    const summary = summarize(`${date}T08:11:00+09:00`);
    expect(summary.isSpecialSchedule).toBe(false);
    expect(summary.departures).toContainEqual({
      routeName: buses[0].routeName, time: "08:15", minutesUntil: 4,
    });
    expect(summarize(`${date}T12:01:00+09:00`).departures).toContainEqual({
      routeName: buses[1].routeName, time: "12:25", minutesUntil: 24,
    });
  });

  it.each(["2026-10-31", "2026-11-01"])("keeps the weekend closed during online-class week: %s", (date) => {
    const summary = summarize(`${date}T08:11:00+09:00`);
    expect(summary.operationStatus).toBe("closed");
    expect(summary.isSpecialSchedule).toBe(false);
    expect(summary.departures).toEqual([]);
  });

  it("changes the online-class schedule at Korean date boundaries", () => {
    expect(summarize("2026-10-27T14:59:00Z").isSpecialSchedule).toBe(false);
    expect(summarize("2026-10-27T15:00:00Z").isSpecialSchedule).toBe(true);
    expect(summarize("2026-11-02T14:59:00Z").isSpecialSchedule).toBe(true);
    expect(summarize("2026-11-02T15:00:00Z").isSpecialSchedule).toBe(false);
  });
});

describe("festival night shuttle", () => {
  it.each(["18:16", "21:59", "22:00", "22:29", "22:30"])(
    "keeps both announced services available at %s after regular departures end",
    (time) => {
      const summary = summarize(`2026-10-06T${time}:00+09:00`);
      expect(summary.departures.map((departure) => departure.routeName)).toEqual([
        "학교 → 화랑대", "학교 → 별내",
      ]);
      expect(summary.departures[0].time).toBe("22:00~22:30");
      expect(summary.departures[0].additionalService?.type).toBe("window");
      expect(summary.departures[1].time).toBe("22:30");
      expect(summary.departures[1].additionalService?.type).toBe("departure");
      expect(summary.hasMoreToday).toBe(true);
      expect(summary.additionalServicePeriods[0].additionalServices).toEqual([
        {
          destination: "hwarangdae", vehicleCount: 5, type: "window",
          startTime: "22:00", endTime: "22:30",
        },
        { destination: "byeollae", vehicleCount: 1, type: "departure", time: "22:30" },
      ]);
    },
  );

  it.each([
    "2026-10-05T21:00:00+09:00",
    "2026-10-06T22:31:00+09:00",
  ])("does not predict remaining festival service at %s", (dateTime) => {
    const summary = summarize(dateTime);
    expect(summary.departures).toEqual([]);
    expect(summary.hasMoreToday).toBe(false);
    expect(summary.additionalServicePeriods).toHaveLength(dateTime.startsWith("2026-10-06") ? 1 : 0);
  });

  it("adds only dated forward service rows and preserves ordinary inbound/loop schedules", () => {
    const before = JSON.stringify(buses);
    const rows = getShuttleAdditionalServiceBuses({ specialPeriods, dateString: "2026-10-06" });
    expect(rows).toHaveLength(2);
    expect(rows[0].startLocation).toBe("학교");
    expect(rows[0].endLocation).toBe("화랑대");
    expect(rows[0].schedules.mondayToThursday).toEqual([]);
    expect(rows[1].schedules.mondayToThursday).toEqual(["22:30"]);
    expect(rows[1].stops).toBeUndefined();
    expect(rows.every((row) => row.lastUpdated === "")).toBe(true);
    for (const dateString of ["2026-10-05", "2026-10-07"]) {
      expect(getShuttleAdditionalServiceBuses({ specialPeriods, dateString })).toEqual([]);
    }
    expect(summarize("2026-10-06T22:15:00+09:00").departures.map((row) => row.minutesUntil)).toEqual([0, 15]);
    expect(JSON.stringify(buses)).toBe(before);
  });

  it("withholds regular predictions only on the Korean interval-notice date", () => {
    expect(summarize("2026-10-05T15:00:00Z").additionalServicePeriods).toHaveLength(1);
    expect(summarize("2026-10-06T15:00:00Z").additionalServicePeriods).toEqual([]);
    expect(summarize("2026-10-06T15:00:00Z").departures.length).toBeGreaterThan(0);
    expect(summarize("2026-10-06T11:55:00+09:00").departures.filter((departure) => !departure.additionalService)).toEqual(
      [],
    );
    expect(summarize("2026-10-07T11:55:00+09:00").departures.some((departure) => !departure.additionalService)).toBe(true);
    expect(summarize("2026-10-05T11:55:00+09:00").departures.some((departure) => !departure.additionalService)).toBe(true);
  });

});


describe("special schedule input recovery", () => {
  it("ignores malformed additional times without losing the ordinary timetable", () => {
    const malformed = { ...specialPeriods, specialPeriods: [{
      ...specialPeriods.specialPeriods.find(period => period.id === "midterm-fall-2026")!,
      addedTimes: "18:40",
    }] } as unknown as ShuttleSpecialPeriods;
    const result = applyShuttleSpecialPeriods({ buses, specialPeriods: malformed, dateString: "2026-10-20" });
    expect(result.buses.map(bus => bus.schedules)).toEqual(buses.map(bus => bus.schedules));
  });
});
