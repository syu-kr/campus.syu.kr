import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ShuttleSection from "./ShuttleSection";
import { fetchBusLocationStatus } from "@/lib/api";
import buses from "@/public/data/shuttle-bus-schedule.json";
import periods from "@/public/data/shuttle-special-periods.json";
import type { PublicHolidaySnapshot, ShuttleSpecialPeriods } from "@/types";
import { getDictionary } from "@/lib/i18n";
import { PUBLIC_HOLIDAY_SOURCE_URL } from "@/lib/public-holidays";

let holidaySnapshot: PublicHolidaySnapshot | undefined;
let shuttlePeriods: ShuttleSpecialPeriods;

beforeEach(() => {
  holidaySnapshot = { schemaVersion: 1, sourceUrl: PUBLIC_HOLIDAY_SOURCE_URL,
    lastSuccessAt: "2026-10-05T00:00:00+09:00", years: [2026], holidays: [] };
  shuttlePeriods = periods as ShuttleSpecialPeriods;
});

vi.mock("@/lib/api", () => ({
  fetchShuttleBuses: async () => buses,
  fetchShuttleSpecialPeriods: async () => shuttlePeriods,
  fetchPublicHolidays: async () => holidaySnapshot ?? {
    schemaVersion: 1, sourceUrl: PUBLIC_HOLIDAY_SOURCE_URL, lastSuccessAt: null, years: [], holidays: [],
  },
  fetchBusLocationStatus: vi.fn(async () => ({
    data: [], timestamp: "2026-10-06T22:15:00+09:00",
    stale: false, sourceStatus: "fresh",
  })),
}));
vi.mock("@/app/features/shuttle/ShuttleMap", () => ({ ShuttleMap: () => null }));

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("public holiday shuttle display", () => {
  const text = getDictionary("ko");
  function mount() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(<QueryClientProvider client={client}><ShuttleSection /></QueryClientProvider>);
    return () => { view.unmount(); client.clear(); };
  }

  it.each(["holiday", "unknown", "stale"])("keeps the timetable and location as references for %s", async (status) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T11:55:00+09:00"));
    holidaySnapshot = { ...holidaySnapshot!, lastSuccessAt: status === "stale"
      ? "2026-09-01T00:00:00Z" : "2026-10-09T00:00:00+09:00",
      years: status === "unknown" ? [] : [2026],
      holidays: status === "holiday" ? [{ date: "2026-10-09", names: ["한글날"] }] : [] };
    const cleanup = mount();
    await screen.findByText("학교 ↔ 석계역(4번 출구)");
    await waitFor(() => expect(fetchBusLocationStatus).toHaveBeenCalledTimes(1));
    expect(screen.getByText(text.publicHolidays.shuttleUnconfirmed)).toBeInTheDocument();
    expect(screen.queryByText(/^현재$/)).not.toBeInTheDocument();
    expect(screen.queryByText("곧 출발하는 버스")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /학교 ↔ 석계역.*펼치기/ }));
    expect(screen.getByText("12:00")).toBeInTheDocument();
    expect(screen.getByText("12:00").className).not.toContain("bg-green");
    cleanup();
  });

  it("shows normal departures after ordinary-day coverage is loaded", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-06T11:55:00+09:00"));
    const cleanup = mount();
    await screen.findByText("곧 출발하는 버스");
    expect(screen.getByText(/^현재$/)).toBeInTheDocument();
    expect(screen.queryByText(text.publicHolidays.shuttleUnconfirmed)).not.toBeInTheDocument();
    cleanup();
  });

  it("stops location polling on a verified closure", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T11:55:00+09:00"));
    shuttlePeriods = { ...shuttlePeriods, closedDates: [{ date: "2026-10-09",
      sourceUrl: "https://www.syu.ac.kr/school-life/school-bus/", verifiedAt: "2026-10-08" }] };
    const cleanup = mount();
    await screen.findByText("학교 ↔ 석계역(4번 출구)");
    expect(screen.getByText(text.publicHolidays.shuttleClosed)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: text.pages.busInfo.verifiedSource }))
      .toHaveAttribute("href", "https://www.syu.ac.kr/school-life/school-bus/");
    expect(screen.queryByText(/^현재$/)).not.toBeInTheDocument();
    expect(screen.queryByText("곧 출발하는 버스")).not.toBeInTheDocument();
    expect(fetchBusLocationStatus).not.toHaveBeenCalled();
    cleanup();
  });

  it("only predicts the verified route on a weekend exception", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-01-02T11:55:00+09:00"));
    shuttlePeriods = { ...shuttlePeriods, serviceExceptions: [{ date: "2027-01-02",
      routeId: "shuttle-1", times: ["12:15"],
      sourceUrl: "https://www.syu.ac.kr/school-life/school-bus/", verifiedAt: "2026-10-08" }] };
    const cleanup = mount();
    await screen.findByText("곧 출발하는 버스");
    expect(screen.getByText(/^현재$/)).toBeInTheDocument();
    expect(screen.queryByText("화랑대역(5번 출구) → 학교")).not.toBeInTheDocument();
    expect(screen.queryByText(text.pages.busInfo.scheduleNotice)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: text.pages.busInfo.verifiedSource }))
      .toHaveAttribute("href", "https://www.syu.ac.kr/school-life/school-bus/");
    fireEvent.click(screen.getByRole("button", { name: /학교 ↔ 석계역.*펼치기/ }));
    expect(screen.queryByText(/최종 업데이트: 2026-04-29/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "학기(월-목)" }));
    expect(screen.getByText(text.pages.busInfo.scheduleNotice)).toBeInTheDocument();
    await waitFor(() => expect(fetchBusLocationStatus).toHaveBeenCalledTimes(1));
    cleanup();
  });
});

describe("shuttle page festival announcement", () => {
  it.each([
    ["2026-10-05T22:15:00+09:00", true],
    ["2026-10-06T22:15:00+09:00", true],
    ["2026-10-06T23:59:00+09:00", true],
    ["2026-10-07T00:00:00+09:00", false],
  ])("expires the advance announcement by the Korean date: %s", async (dateTime, visible) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(dateTime));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={client}>
        <ShuttleSection />
      </QueryClientProvider>,
    );
    await screen.findByText("학교 ↔ 석계역(4번 출구)");
    expect(screen.queryByText("축제 야간 특별운행") !== null).toBe(visible);
    expect(fetchBusLocationStatus).toHaveBeenCalledTimes(
      dateTime === "2026-10-06T22:15:00+09:00" ? 1 : 0,
    );
    view.unmount();
    client.clear();
  });
});
