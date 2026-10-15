import { act, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/app/components/LocaleProvider";
import { fetchShuttleBuses, fetchShuttleSpecialPeriods } from "@/lib/api";
import { getDictionary, type Locale } from "@/lib/i18n";
import { PUBLIC_HOLIDAY_SOURCE_URL } from "@/lib/public-holidays";
import buses from "@/public/data/shuttle-bus-schedule.json";
import periods from "@/public/data/shuttle-special-periods.json";
import type { ShuttleSpecialPeriods } from "@/types";
import ShuttleSection, { type ShuttleInitialData } from "./ShuttleSection";

vi.mock("@/lib/api", () => ({
  fetchShuttleBuses: vi.fn(),
  fetchShuttleSpecialPeriods: vi.fn(),
  fetchPublicHolidays: vi.fn(),
  fetchBusLocationStatus: vi.fn(async () => ({
    data: [], timestamp: "2026-10-07T11:55:00+09:00", stale: false, sourceStatus: "fresh",
  })),
}));
vi.mock("@/app/features/shuttle/ShuttleMap", () => ({ ShuttleMap: () => null }));

afterEach(() => vi.useRealTimers());

function initialData(nowISO = "2026-10-07T11:55:00+09:00"): ShuttleInitialData {
  return {
    buses,
    specialPeriods: periods as ShuttleSpecialPeriods,
    holidays: {
      schemaVersion: 1, sourceUrl: PUBLIC_HOLIDAY_SOURCE_URL,
      lastSuccessAt: "2026-10-06T01:00:00Z", years: [2026], holidays: [],
    },
    nowISO,
  };
}

function content(client: QueryClient, data: ShuttleInitialData, locale: Locale = "ko") {
  return (
    <QueryClientProvider client={client}>
      <LocaleProvider locale={locale}>
        <ShuttleSection initialData={data} />
      </LocaleProvider>
    </QueryClientProvider>
  );
}

describe("shuttle departures and bottom source links", () => {
  it.each(["ko", "en"] as const)("server renders departures once and sources below the timetable in %s", (locale) => {
    const data = initialData();
    const client = new QueryClient();
    const parsed = new DOMParser().parseFromString(renderToString(content(client, data, locale)), "text/html");
    const text = getDictionary(locale);
    const footer = parsed.querySelector("footer")!;
    const timetable = parsed.getElementById("shuttle-schedules")!;

    expect(parsed.body.textContent).not.toContain(text.pages.busInfo.answer.title);
    expect(parsed.body.textContent).not.toContain(text.pages.busInfo.answer.question);
    expect(parsed.body.textContent).not.toContain(text.answerSummary.basisLabel);
    expect(parsed.querySelector("#shuttle-answer-schema, [data-answer-text]")).toBeNull();
    expect(parsed.querySelector(`section[aria-label="${text.pages.busInfo.upcomingBuses}"]`)?.textContent).toContain("12:00");
    expect(footer.querySelector(`a[href="${PUBLIC_HOLIDAY_SOURCE_URL}"]`)).not.toBeNull();
    expect(footer.querySelector("time")).toBeNull();
    expect(timetable.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(footer.parentElement!.lastElementChild).toBe(footer);
    client.clear();
  });

  it("keeps the existing upcoming departure card updated at a departure boundary", async () => {
    vi.useFakeTimers();
    const data = initialData("2026-10-07T11:59:59+09:00");
    vi.setSystemTime(new Date(data.nowISO));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(content(client, data));
    const region = within(screen.getByRole("region", { name: getDictionary("ko").pages.busInfo.upcomingBuses }));
    expect(region.getAllByText("12:00").length).toBeGreaterThan(0);

    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });

    expect(region.queryByText("12:00")).not.toBeInTheDocument();
    expect(region.getAllByText("12:25").length).toBeGreaterThan(0);
    view.unmount();
    client.clear();
  });

  it("keeps a verified exception departure with its source at the bottom and holiday warning", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const data = initialData("2027-01-02T11:55:00+09:00");
    vi.setSystemTime(new Date(data.nowISO));
    const evidence = {
      date: "2027-01-02", routeId: "shuttle-1", times: ["12:15"],
      sourceUrl: "https://www.syu.ac.kr/school-life/school-bus/",
      verifiedAt: "2026-12-31T03:00:00Z",
    };
    data.specialPeriods = { ...data.specialPeriods, serviceExceptions: [evidence] };
    const client = new QueryClient();
    const view = render(content(client, data));
    const text = getDictionary("ko");
    const footer = within(view.container.querySelector("footer")!);

    expect(footer.getByRole("link", { name: text.pages.busInfo.verifiedSource })).toHaveAttribute("href", evidence.sourceUrl);
    expect(footer.getByText(text.publicHolidays.stale)).toBeInTheDocument();
    expect(screen.queryByText(text.pages.busInfo.scheduleNotice)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: text.pages.busInfo.upcomingBuses })).toHaveTextContent("12:15");
    expect(view.container.querySelector("time")).toBeNull();
    view.unmount();
    client.clear();
  });

  it("hides upcoming departures and retains the warning when holiday coverage becomes stale", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const data = initialData();
    vi.setSystemTime(new Date(data.nowISO));
    const client = new QueryClient();
    const view = render(content(client, data));
    const text = getDictionary("ko");
    expect(screen.getByRole("region", { name: text.pages.busInfo.upcomingBuses })).toHaveTextContent("12:00");

    act(() => { client.setQueryData(["public-holidays"], { ...data.holidays, stale: true }); });

    await waitFor(() => expect(screen.queryByRole("region", { name: text.pages.busInfo.upcomingBuses })).not.toBeInTheDocument());
    expect(screen.getByText(text.publicHolidays.shuttleUnconfirmed)).toBeInTheDocument();
    expect(within(view.container.querySelector("footer")!).getByText(text.publicHolidays.stale)).toBeInTheDocument();
    view.unmount();
    client.clear();
  });

  it.each(["shuttle-buses", "shuttle-special-periods"] as const)("shows the error and retry without retained predictions after a failed %s refresh", async (queryKey) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const data = initialData();
    vi.setSystemTime(new Date(data.nowISO));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(content(client, data));
    const text = getDictionary("ko");
    expect(screen.getByRole("region", { name: text.pages.busInfo.upcomingBuses })).toHaveTextContent("12:00");
    const fetchData = queryKey === "shuttle-buses" ? fetchShuttleBuses : fetchShuttleSpecialPeriods;
    vi.mocked(fetchData).mockRejectedValueOnce(new Error("Source unavailable"));

    await act(async () => { await client.refetchQueries({ queryKey: [queryKey] }); });

    await waitFor(() => expect(screen.getByText(text.home.dashboard.loadFailedMessage)).toBeInTheDocument());
    expect(screen.queryByRole("region", { name: text.pages.busInfo.upcomingBuses })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: text.home.dashboard.retry })).toBeInTheDocument();
    expect(client.getQueryData([queryKey])).toEqual(queryKey === "shuttle-buses" ? data.buses : data.specialPeriods);
    expect(within(view.container.querySelector("footer")!).getByRole("link", { name: text.publicHolidays.source })).toBeInTheDocument();
    view.unmount();
    client.clear();
  });
});
