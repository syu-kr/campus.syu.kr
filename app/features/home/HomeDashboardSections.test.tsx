import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TodayShuttleSection } from "./HomeDashboardSections";
import { getDictionary } from "@/lib/i18n";
import { emptyPublicHolidays, PUBLIC_HOLIDAY_SOURCE_URL } from "@/lib/public-holidays";
import festivalPeriods from "@/public/data/shuttle-special-periods.json";
import type { PublicHolidaySnapshot, ShuttleBusSchedule, ShuttleSpecialPeriods } from "@/types";

const dictionary = getDictionary("ko");
const holidays: PublicHolidaySnapshot = {
  schemaVersion: 1,
  sourceUrl: PUBLIC_HOLIDAY_SOURCE_URL,
  lastSuccessAt: "2026-10-08T00:00:00+09:00",
  years: [2026],
  holidays: [{ date: "2026-10-09", names: ["한글날"] }],
};
const buses: ShuttleBusSchedule[] = [{
  id: "test-shuttle", routeName: "검증용 셔틀", startLocation: "학교", endLocation: "역",
  lastUpdated: "2026-10-08",
  schedules: {
    mondayToThursday: ["12:15"], friday: ["12:15"],
    mondayToThursdayVacation: ["12:15"], fridayVacation: ["12:15"],
  },
}];
const specialPeriods: ShuttleSpecialPeriods = {
  specialPeriods: [], vacationPeriods: [],
  semesterPeriods: [{
    id: "test-semester", name: "학기", startDate: "2026-09-01", endDate: "2026-12-14", scheduleType: "semester",
  }],
};

describe("home shuttle operation notices", () => {
  it("keeps the dated festival notice when holiday coverage is unavailable without predicting regular departures", () => {
    render(<TodayShuttleSection isLoading={false} isError={false} onRetry={vi.fn()}
      buses={buses} holidays={emptyPublicHolidays()}
      specialPeriods={festivalPeriods as ShuttleSpecialPeriods}
      now={new Date("2026-10-06T11:55:00+09:00")} />);

    expect(screen.getByRole("heading", { name: dictionary.pages.busInfo.festivalShuttle.noticeTitle })).toBeInTheDocument();
    expect(screen.getByText("10:00 이후: 30분 간격")).toBeInTheDocument();
    expect(screen.queryByText(/12:15|분 후 예정 출발/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: buses[0].routeName })).not.toBeInTheDocument();
  });

  it("shows the weekend closure even when holiday coverage is unavailable", () => {
    render(<TodayShuttleSection isLoading={false} isError={false} onRetry={vi.fn()}
      buses={buses} holidays={emptyPublicHolidays()} specialPeriods={specialPeriods}
      now={new Date("2026-10-10T11:55:00+09:00")} />);

    expect(screen.getByText(dictionary.home.dashboard.shuttleWeekend)).toBeInTheDocument();
    expect(screen.queryByText(dictionary.publicHolidays.shuttleUnconfirmed)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: buses[0].routeName })).not.toBeInTheDocument();
  });

  it("shows a confirmed ordinary-day closure without an unavailable-holiday title or departure prediction", () => {
    render(<TodayShuttleSection isLoading={false} isError={false} onRetry={vi.fn()}
      buses={buses} holidays={holidays} now={new Date("2026-10-08T11:55:00+09:00")}
      specialPeriods={{ ...specialPeriods, closedDates: [{
        date: "2026-10-08", sourceUrl: "https://www.syu.ac.kr/school-life/school-bus/", verifiedAt: "2026-10-07",
      }] }} />);

    expect(screen.getByRole("heading", { level: 3, name: dictionary.home.dashboard.shuttle })).toBeInTheDocument();
    expect(screen.getByText(dictionary.publicHolidays.shuttleClosed)).toBeInTheDocument();
    expect(screen.queryByText(dictionary.publicHolidays.unavailable)).not.toBeInTheDocument();
    expect(screen.queryByText(dictionary.publicHolidays.shuttleUnconfirmed)).not.toBeInTheDocument();
    expect(screen.queryByText(dictionary.home.dashboard.shuttleNoMore)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: buses[0].routeName })).not.toBeInTheDocument();
    expect(screen.queryByText(/12:15/)).not.toBeInTheDocument();
  });

  it.each([
    ["holiday", holidays, "한글날", dictionary.publicHolidays.shuttleHolidayClosedNamed.replace("{holiday}", "한글날")],
    ["missing coverage", emptyPublicHolidays(), dictionary.publicHolidays.unavailable, dictionary.publicHolidays.shuttleUnconfirmed],
  ] as const)("suppresses departures and shows the appropriate notice for %s", (_scenario, snapshot, title, message) => {
    const props = {
      isLoading: false, isError: false, onRetry: vi.fn(), buses, specialPeriods,
      now: new Date("2026-10-09T11:55:00+09:00"),
    };
    const view = render(<TodayShuttleSection {...props} holidays={{ ...holidays, holidays: [] }} />);
    expect(screen.getByRole("heading", { name: buses[0].routeName })).toBeInTheDocument();
    expect(screen.getByText(/12:15/)).toBeInTheDocument();

    view.rerender(<TodayShuttleSection {...props} holidays={snapshot} />);
    expect(screen.getByRole("heading", { level: 3, name: title })).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByText(snapshot.holidays.length
      ? dictionary.publicHolidays.shuttleUnconfirmed
      : dictionary.publicHolidays.shuttleHolidayClosed)).not.toBeInTheDocument();
    expect(screen.queryByText(dictionary.publicHolidays.shuttleClosed)).not.toBeInTheDocument();
    expect(screen.queryByText(dictionary.home.dashboard.shuttleNoMore)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: buses[0].routeName })).not.toBeInTheDocument();
    expect(screen.queryByText(/12:15/)).not.toBeInTheDocument();
  });
});
