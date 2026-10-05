import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
let pendingHolidaySnapshot: Promise<PublicHolidaySnapshot> | undefined;
let holidayRequestFailure = false;

beforeEach(() => {
  holidaySnapshot = { schemaVersion: 1, sourceUrl: PUBLIC_HOLIDAY_SOURCE_URL,
    lastSuccessAt: "2026-10-05T00:00:00+09:00", years: [2026], holidays: [] };
  shuttlePeriods = periods as ShuttleSpecialPeriods;
  pendingHolidaySnapshot = undefined;
  holidayRequestFailure = false;
  vi.mocked(fetchBusLocationStatus).mockResolvedValue({
    success: true, source: "shuttle", data: [], timestamp: "2026-10-06T11:55:00+09:00",
    stale: false, sourceStatus: "fresh",
  });
});

vi.mock("@/lib/api", () => ({
  fetchShuttleBuses: async () => buses,
  fetchShuttleSpecialPeriods: async () => shuttlePeriods,
  fetchPublicHolidays: async () => {
    if (holidayRequestFailure) throw new Error("holiday source unavailable");
    return pendingHolidaySnapshot ?? holidaySnapshot ?? {
      schemaVersion: 1, sourceUrl: PUBLIC_HOLIDAY_SOURCE_URL, lastSuccessAt: null, years: [], holidays: [],
    };
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

  it.each(["unknown", "stale"])("keeps the timetable and location as references for %s", async (status) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T11:55:00+09:00"));
    holidaySnapshot = { ...holidaySnapshot!, lastSuccessAt: status === "stale"
      ? "2026-09-01T00:00:00Z" : "2026-10-09T00:00:00+09:00",
      years: status === "unknown" ? [] : [2026], holidays: [] };
    const cleanup = mount();
    await screen.findByText("학교 ↔ 석계역(4번 출구)");
    await waitFor(() => expect(fetchBusLocationStatus).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(text.publicHolidays.shuttleUnconfirmed)).toBeInTheDocument();
    expect(screen.queryByText(text.publicHolidays.shuttleHolidayClosed)).not.toBeInTheDocument();
    expect(screen.getByText(text.publicHolidays.referenceSchedule)).toBeInTheDocument();
    expect(screen.queryByText(/^현재$/)).not.toBeInTheDocument();
    expect(screen.queryByText("곧 출발하는 버스")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /학교 ↔ 석계역.*펼치기/ }));
    expect(screen.getByText("12:00")).toBeInTheDocument();
    expect(screen.getByText("12:00").className).not.toContain("bg-green");
    cleanup();
  });

  it.each([
    ["2026-10-05", "대체공휴일(개천절)"],
    ["2026-10-09", "한글날"],
  ])("shows the holiday reason and hides live locations on %s", async (date, holiday) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${date}T11:55:00+09:00`));
    holidaySnapshot = { ...holidaySnapshot!, lastSuccessAt: `${date}T00:00:00+09:00`,
      holidays: [{ date, names: [holiday] }] };
    const cleanup = mount();
    await screen.findByText(text.publicHolidays.shuttleHolidayClosedNamed.replace("{holiday}", holiday));
    expect(screen.queryByText(text.pages.busInfo.liveLocation)).not.toBeInTheDocument();
    expect(screen.queryByText(text.publicHolidays.shuttleUnconfirmed)).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp(text.publicHolidays.updatedAt))).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: text.publicHolidays.source })).not.toBeInTheDocument();
    expect(fetchBusLocationStatus).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /학교 ↔ 석계역.*펼치기/ }));
    expect(screen.getByText("12:00")).toBeInTheDocument();
    expect(screen.getByText("12:00").className).not.toContain("bg-green");
    cleanup();
  });

  it("waits for holiday data before requesting live locations", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T11:55:00+09:00"));
    let resolveHolidays!: (snapshot: PublicHolidaySnapshot) => void;
    pendingHolidaySnapshot = new Promise((resolve) => { resolveHolidays = resolve; });
    const cleanup = mount();
    await screen.findByText("학교 ↔ 석계역(4번 출구)");
    expect(fetchBusLocationStatus).not.toHaveBeenCalled();
    resolveHolidays({ ...holidaySnapshot!, holidays: [{ date: "2026-10-05", names: ["대체공휴일(개천절)"] }] });
    await screen.findByText(text.publicHolidays.shuttleHolidayClosedNamed.replace("{holiday}", "대체공휴일(개천절)"));
    expect(fetchBusLocationStatus).not.toHaveBeenCalled();
    cleanup();
  });

  it("does not restart polling when an in-flight location request completes after a holiday closure", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T11:55:00+09:00"));
    vi.spyOn(Math, "random").mockReturnValue(0);
    const response: Awaited<ReturnType<typeof fetchBusLocationStatus>> = {
      success: true, source: "shuttle", data: [], timestamp: "2026-10-05T11:55:00+09:00",
      stale: false, sourceStatus: "fresh",
    };
    let resolveLocation!: (value: typeof response) => void;
    const pendingLocation = new Promise<typeof response>((resolve) => { resolveLocation = resolve; });
    vi.mocked(fetchBusLocationStatus).mockResolvedValueOnce(response).mockImplementationOnce(() => pendingLocation);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(["shuttle-buses"], buses);
    client.setQueryData(["shuttle-special-periods"], shuttlePeriods);
    client.setQueryData(["public-holidays"], holidaySnapshot);
    const view = render(<QueryClientProvider client={client}><ShuttleSection /></QueryClientProvider>);
    await act(async () => { await Promise.resolve(); });
    expect(fetchBusLocationStatus).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(fetchBusLocationStatus).toHaveBeenCalledTimes(2);

    act(() => {
      client.setQueryData(["public-holidays"], { ...holidaySnapshot,
        holidays: [{ date: "2026-10-05", names: ["대체공휴일(개천절)"] }] });
      vi.advanceTimersByTime(0);
    });
    expect(screen.queryByText(text.pages.busInfo.liveLocation)).not.toBeInTheDocument();
    await act(async () => { resolveLocation(response); });
    act(() => { vi.advanceTimersByTime(120_000); });
    expect(fetchBusLocationStatus).toHaveBeenCalledTimes(2);
    view.unmount();
    client.clear();
  });

  it.each([false, true])("handles a failed holiday refresh conservatively (known holiday: %s)", async (isHoliday) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T11:55:00+09:00"));
    holidaySnapshot = { ...holidaySnapshot!, lastSuccessAt: "2026-10-09T00:00:00+09:00",
      holidays: isHoliday ? [{ date: "2026-10-09", names: ["한글날"] }] : [] };
    const holidayMessage = text.publicHolidays.shuttleHolidayClosedNamed.replace("{holiday}", "한글날");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(<QueryClientProvider client={client}><ShuttleSection /></QueryClientProvider>);
    await screen.findByText(isHoliday ? holidayMessage : text.pages.busInfo.upcomingBuses);
    holidayRequestFailure = true;
    await client.refetchQueries({ queryKey: ["public-holidays"] });
    await waitFor(() => expect(client.getQueryState(["public-holidays"])?.status).toBe("error"));
    expect(await screen.findByText(isHoliday ? holidayMessage : text.publicHolidays.shuttleUnconfirmed)).toBeInTheDocument();
    expect(screen.queryByText(text.pages.busInfo.upcomingBuses)).not.toBeInTheDocument();
    if (isHoliday) expect(fetchBusLocationStatus).not.toHaveBeenCalled();
    view.unmount();
    client.clear();
  });

  it("shows normal departures after ordinary-day coverage is loaded", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-06T11:55:00+09:00"));
    const cleanup = mount();
    await screen.findByText("곧 출발하는 버스");
    expect(screen.getByText(/^현재$/)).toBeInTheDocument();
    expect(screen.queryByText(text.publicHolidays.shuttleUnconfirmed)).not.toBeInTheDocument();
    expect(screen.queryByText(text.publicHolidays.shuttleHolidayClosed)).not.toBeInTheDocument();
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
    expect(screen.queryByText(/^현재$/)).not.toBeInTheDocument();
    expect(screen.queryByText("곧 출발하는 버스")).not.toBeInTheDocument();
    expect(fetchBusLocationStatus).not.toHaveBeenCalled();
    cleanup();
  });

  it.each(["request failure", "upstream error", "stale fallback"])("shows a location loading failure rather than an empty-bus state for %s", async (failure) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-06T11:55:00+09:00"));
    if (failure === "request failure") {
      vi.mocked(fetchBusLocationStatus).mockRejectedValue(new Error("location unavailable"));
    } else {
      vi.mocked(fetchBusLocationStatus).mockResolvedValue({
        success: true, source: "shuttle", data: [], timestamp: "2026-10-06T11:55:00+09:00",
        stale: true, sourceStatus: failure === "stale fallback" ? "stale" : "error",
      });
    }
    const cleanup = mount();
    expect(await screen.findByText(text.pages.busInfo.locationError)).toBeInTheDocument();
    expect(screen.getByText(text.pages.busInfo.locationErrorMessage)).toBeInTheDocument();
    expect(screen.queryByText(text.pages.busInfo.locationEmptyTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(/책임을 지지 않습니다/)).not.toBeInTheDocument();
    cleanup();
  });

  it("keeps a successful empty location response distinct from a request failure", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-06T11:55:00+09:00"));
    const cleanup = mount();
    expect(await screen.findByText(text.pages.busInfo.locationEmptyTitle)).toBeInTheDocument();
    expect(screen.queryByText(text.pages.busInfo.locationError)).not.toBeInTheDocument();
    cleanup();
  });

  it.each(["stale", "error"] as const)("retains cached active locations with a short failure warning for %s", async (sourceStatus) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-06T11:55:00+09:00"));
    vi.mocked(fetchBusLocationStatus).mockResolvedValue({
      success: true, source: "shuttle", timestamp: "2026-10-06T11:54:00+09:00",
      stale: true, sourceStatus,
      data: [{ id: "1", name: "1", lat: "37.64", lon: "127.11", routeid: 1, status: 1 }],
    });
    const cleanup = mount();
    expect(await screen.findByRole("button", { name: `화랑대역 ${text.pages.busInfo.schoolToStation}` })).toBeInTheDocument();
    expect(screen.getByText(`${text.pages.busInfo.locationError} ${text.pages.busInfo.staleLocationWarning}`)).toBeInTheDocument();
    expect(screen.queryByText(text.pages.busInfo.locationEmptyTitle)).not.toBeInTheDocument();
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
    expect(screen.queryByText(text.publicHolidays.shuttleHolidayClosed)).not.toBeInTheDocument();
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
    ["2026-10-05T22:15:00+09:00", false],
    ["2026-10-06T22:15:00+09:00", true],
    ["2026-10-06T23:59:00+09:00", true],
    ["2026-10-07T00:00:00+09:00", false],
  ])("shows the detailed announcement only on the Korean service date: %s", async (dateTime, visible) => {
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
    expect(screen.queryByRole("heading", { level: 2, name: "학교 → 화랑대" }) !== null).toBe(visible);
    expect(screen.queryByRole("heading", { level: 2, name: "학교 → 별내" }) !== null).toBe(visible);
    expect(fetchBusLocationStatus).toHaveBeenCalledTimes(
      dateTime === "2026-10-06T22:15:00+09:00" ? 1 : 0,
    );
    view.unmount();
    client.clear();
  });

  it("adds dedicated forward timetable rows without adding departures to the reverse or circular routes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-06T22:15:00+09:00"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(<QueryClientProvider client={client}><ShuttleSection /></QueryClientProvider>);
    const hwarangdae = await screen.findByRole("button", { name: "학교 → 화랑대 시간표 펼치기" });
    const byeollae = screen.getByRole("button", { name: "학교 → 별내 시간표 펼치기" });
    fireEvent.click(hwarangdae);
    fireEvent.click(byeollae);
    expect(within(hwarangdae.parentElement!).getAllByText(/22:00~22:30 · 총 5대/)).toHaveLength(2);
    expect(within(hwarangdae.parentElement!).queryByText("22:00")).not.toBeInTheDocument();
    expect(within(hwarangdae.parentElement!).getAllByText(/만차 시 바로 출발/)).toHaveLength(2);
    expect(within(byeollae.parentElement!).getAllByText(/22:30 예정 출발 · 1대/)).toHaveLength(2);
    expect(within(byeollae.parentElement!).getByText(/학생회 야간버스 운행 안내/)).toBeInTheDocument();

    for (const route of [/화랑대역\(5번 출구\) → 학교.*펼치기/, /학교 ↔ 별내역.*펼치기/]) {
      const button = screen.getByRole("button", { name: route });
      fireEvent.click(button);
      expect(within(button.parentElement!).queryByText(/22:(00|30)/)).not.toBeInTheDocument();
    }
    view.unmount();
    client.clear();
  });

  it.each([
    ["21:40", "20분 후 안내된 운행 시간대가 시작됩니다.", false],
    ["22:15", "안내된 운행 시간대입니다.", true],
    ["22:30", "안내된 운행 시간대입니다.", true],
  ])("includes the special window and scheduled departure in next departures at %s", async (time, windowMessage, showByeollae) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`2026-10-06T${time}:00+09:00`));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(<QueryClientProvider client={client}><ShuttleSection /></QueryClientProvider>);
    const upcoming = within(await screen.findByRole("region", { name: "곧 출발하는 버스" }));
    expect(upcoming.getByRole("heading", { name: "학교 → 화랑대" })).toBeInTheDocument();
    expect(upcoming.getByText(windowMessage)).toBeInTheDocument();
    expect(upcoming.queryByRole("heading", { name: "학교 → 별내" }) !== null).toBe(showByeollae);
    if (showByeollae) {
      expect(upcoming.getByText(/22:30 예정 출발 · 1대/)).toBeInTheDocument();
      expect(upcoming.getByText(time === "22:30" ? "예정 출발 시각입니다." : "15분 후 예정 출발 (예정 시각 기준)")).toBeInTheDocument();
    }
    expect(upcoming.queryByText(/운행 중|5대 남/)).not.toBeInTheDocument();
    view.unmount();
    client.clear();
  });

  it("ends next-departure cards after the special service window while keeping that day's timetable", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-06T22:31:00+09:00"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(<QueryClientProvider client={client}><ShuttleSection /></QueryClientProvider>);
    await screen.findByRole("heading", { level: 2, name: "학교 → 화랑대" });
    expect(screen.queryByRole("region", { name: "곧 출발하는 버스" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "학교 → 별내" })).toBeInTheDocument();
    view.unmount();
    client.clear();
  });

  it("keeps exam extensions in the timetable and respects the selected day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-04-21T18:35:00+09:00"));
    holidaySnapshot = { ...holidaySnapshot!, lastSuccessAt: "2026-04-21T00:00:00+09:00" };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(<QueryClientProvider client={client}><ShuttleSection /></QueryClientProvider>);
    const upcoming = within(await screen.findByRole("region", { name: "곧 출발하는 버스" }));
    expect(upcoming.getByText("18:40")).toBeInTheDocument();
    const timetable = await screen.findByRole("button", { name: /학교 ↔ 석계역.*펼치기/ });
    fireEvent.click(timetable);
    expect(within(timetable.parentElement!).getByText("18:40")).toBeInTheDocument();
    expect(within(timetable.parentElement!).getByText("19:00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "학기(금)" }));
    expect(screen.queryByRole("region", { name: "곧 출발하는 버스" })).not.toBeInTheDocument();
    view.unmount();
    client.clear();
  });
});
