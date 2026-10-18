import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TodayMenuSection, TodayShuttleSection } from "./HomeDashboardSections";
import { LocaleProvider } from "@/app/components/LocaleProvider";
import { getTodayInfo } from "@/lib/home";
import { getDictionary } from "@/lib/i18n";
import { emptyPublicHolidays, PUBLIC_HOLIDAY_SOURCE_URL } from "@/lib/public-holidays";
import festivalPeriods from "@/public/data/shuttle-special-periods.json";
import type { CafeteriaMenu, PublicHolidaySnapshot, ShuttleBusSchedule, ShuttleSpecialPeriods } from "@/types";

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

const clients: QueryClient[] = [];

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("home cafeteria section", () => {
  const todayMenu: CafeteriaMenu = {
    id: "su-lounge", date: "2026-10-16", dayOfWeek: "금요일", location: "SU-Lounge",
    breakfast: [{ name: "SU 오늘 조식" }], lunch: {}, dinner: [],
  };

  it("groups both restaurant previews under one cafeteria heading on weekdays", async () => {
    vi.stubEnv("NEXT_PUBLIC_CAFETERIA_JSON_URL", "https://example.github.io/cafeteria/student-restaurant-1.json");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      updatedAt: "2026-10-16T00:00:00Z", weekStart: "2026-10-12",
      days: [{ date: "2026-10-16", breakfast: ["오무라이스/계란지단", "계란스크럼블"], lunch: [], dinner: null }],
    }) }));
    const client = new QueryClient();
    clients.push(client);
    render(
      <QueryClientProvider client={client}>
        <TodayMenuSection isLoading={false} isError={false} onRetry={vi.fn()}
          todayInfo={getTodayInfo(new Date("2026-10-16T12:00:00+09:00"))} todayMenu={todayMenu} />
      </QueryClientProvider>,
    );

    const section = screen.getByRole("region", { name: dictionary.home.dashboard.cafeteria });
    expect(await within(section).findByText("오무라이스/계란지단, 계란스크럼블")).toBeInTheDocument();
    expect(within(section).getAllByRole("heading", { level: 2 })).toHaveLength(1);
    expect(within(section).getByRole("heading", { level: 3, name: "SU-Lounge" })).toBeInTheDocument();
    expect(within(section).getByRole("heading", { level: 3, name: dictionary.pages.cafeteria.studentRestaurant.title })).toBeInTheDocument();
    expect(within(section).getByText("SU 오늘 조식")).toBeInTheDocument();
    expect(within(section).getByText(dictionary.pages.cafeteria.studentRestaurant.unknownMeal)).toBeInTheDocument();
    expect(within(section).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/campus/cafeteria", "/campus/cafeteria?restaurant=manna", "/campus/cafeteria?restaurant=manna",
    ]);
  });

  it.each([
    ["2026-10-17", "ko"],
    ["2026-10-18", "en"],
  ] as const)("shows just one weekend notice on %s even while menu sources are loading or failing", (today, locale) => {
    const localizedDictionary = getDictionary(locale);
    vi.stubEnv("NEXT_PUBLIC_CAFETERIA_JSON_URL", "https://example.github.io/cafeteria/student-restaurant-1.json");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(
      <LocaleProvider locale={locale}>
        <TodayMenuSection isLoading isError hasStaleMenuData onRetry={vi.fn()}
          todayInfo={getTodayInfo(new Date(`${today}T12:00:00+09:00`))} todayMenu={todayMenu} />
      </LocaleProvider>,
    );

    const section = screen.getByRole("region", { name: localizedDictionary.home.dashboard.cafeteria });
    expect(within(section).getAllByText(localizedDictionary.home.dashboard.weekendMenu)).toHaveLength(1);
    expect(within(section).getAllByRole("heading")).toHaveLength(1);
    expect(within(section).getAllByRole("link")).toHaveLength(1);
    expect(within(section).getByRole("link", { name: localizedDictionary.home.dashboard.fullMenu }))
      .toHaveAttribute("href", `${locale === "en" ? "/en" : ""}/campus/cafeteria`);
    expect(within(section).queryByRole("status")).not.toBeInTheDocument();
    expect(within(section).queryByRole("button")).not.toBeInTheDocument();
    expect(within(section).queryByText(localizedDictionary.home.dashboard.loadFailedMessage)).not.toBeInTheDocument();
    expect(within(section).queryByText(localizedDictionary.pages.cafeteria.missingToday)).not.toBeInTheDocument();
    expect(within(section).queryByText("SU 오늘 조식")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});

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
