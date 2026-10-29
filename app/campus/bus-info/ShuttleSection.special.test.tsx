import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/app/components/LocaleProvider";
import { getDictionary } from "@/lib/i18n";
import { PUBLIC_HOLIDAY_SOURCE_URL } from "@/lib/public-holidays";
import buses from "@/public/data/shuttle-bus-schedule.json";
import periods from "@/public/data/shuttle-special-periods.json";
import type { ShuttleSpecialPeriods } from "@/types";
import ShuttleSection, { type ShuttleInitialData } from "./ShuttleSection";

vi.mock("@/lib/api", () => ({
  fetchShuttleBuses: vi.fn(), fetchShuttleSpecialPeriods: vi.fn(), fetchPublicHolidays: vi.fn(),
  fetchBusLocationStatus: vi.fn(async () => ({ data: [], timestamp: "2026-10-20T18:35:00+09:00", stale: false, sourceStatus: "fresh" })),
}));
vi.mock("@/app/features/shuttle/ShuttleMap", () => ({ ShuttleMap: () => null }));
afterEach(() => vi.useRealTimers());
const text = getDictionary("ko").pages.busInfo;
function fixture(date = "2026-10-20T18:35:00+09:00"): ShuttleInitialData {
  return { buses, specialPeriods: periods as ShuttleSpecialPeriods, nowISO: date,
    holidays: { schemaVersion: 1, sourceUrl: PUBLIC_HOLIDAY_SOURCE_URL, lastSuccessAt: date, years: [2026], holidays: [] } };
}
function content(client: QueryClient, data: ShuttleInitialData) {
  return <QueryClientProvider client={client}><LocaleProvider locale="ko"><ShuttleSection initialData={data} /></LocaleProvider></QueryClientProvider>;
}
describe("separate additional-service timetable", () => {
  it("includes the selected special timetable in the first server HTML", () => {
    const client = new QueryClient();
    const parsed = new DOMParser().parseFromString(renderToString(content(client, fixture())), "text/html");
    const special = [...parsed.querySelectorAll("button")].find(el => el.textContent?.includes("중간고사 연장 운행"));
    expect(special?.getAttribute("aria-pressed")).toBe("true");
    expect(parsed.querySelector('#shuttle-schedules')?.getAttribute("aria-label")).toContain("중간고사 연장 운행");
    client.clear();
  });
  it.each(["2026-04-21", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-26", "2026-06-09"])("separates the original and extension on %s", (date) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const data = fixture(`${date}T18:35:00+09:00`); vi.setSystemTime(new Date(data.nowISO));
    const client = new QueryClient(); const view = render(content(client, data));
    const special = screen.getByRole("button", { name: /고사 연장 운행/ });
    expect(special).toHaveAttribute("aria-pressed", "true");
    expect(within(special).getByText(text.current)).toBeInTheDocument();
    const expand = () => { const b = screen.getByRole("button", { name: /학교 ↔ 석계역.*펼치기/ }); fireEvent.click(b); return within(b.parentElement!); };
    expect(expand().getByText("19:00")).toBeInTheDocument();
    const ordinary = screen.getByRole("button", { name: text.semesterMonThu });
    fireEvent.click(ordinary);
    expect(ordinary).toHaveAttribute("aria-pressed", "true");
    expect(within(ordinary).queryByText(text.current)).not.toBeInTheDocument();
    expect(expand().queryByText("19:00")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: text.upcomingBuses })).not.toBeInTheDocument();
    fireEvent.click(special);
    expect(expand().getByText("18:40")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: text.upcomingBuses })).toHaveTextContent("18:40");
    view.unmount(); client.clear();
  });
  it("keeps festival routes in the special view and ordinary times in the reference view", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const data = fixture("2026-10-06T22:15:00+09:00"); vi.setSystemTime(new Date(data.nowISO));
    const client = new QueryClient(); const view = render(content(client, data));
    const special = screen.getByRole("button", { name: /천보축전 셔틀 운행 안내/ });
    expect(special).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { level: 2, name: "학교 → 화랑대" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: text.semesterMonThu }));
    expect(screen.queryByRole("heading", { level: 2, name: "학교 → 화랑대" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: text.upcomingBuses })).not.toBeInTheDocument();
    fireEvent.click(special);
    expect(screen.getByRole("heading", { level: 2, name: "학교 → 화랑대" })).toBeInTheDocument();
    view.unmount(); client.clear();
  });
  it("does not offer an extension on an excluded Friday", () => {
    vi.useFakeTimers({ toFake: ["Date"] }); const data = fixture("2026-10-23T18:35:00+09:00"); vi.setSystemTime(new Date(data.nowISO));
    const client = new QueryClient(); const view = render(content(client, data));
    expect(screen.queryByRole("button", { name: /고사 연장 운행/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: name => name.startsWith(text.semesterFri) })).toHaveAttribute("aria-pressed", "true");
    view.unmount(); client.clear();
  });
  it("returns to the current ordinary timetable when the special day ends in KST", async () => {
    vi.useFakeTimers(); const data = fixture("2026-10-22T23:59:59+09:00"); vi.setSystemTime(new Date(data.nowISO));
    const client = new QueryClient(); const view = render(content(client, data));
    expect(screen.getByRole("button", { name: /고사 연장 운행/ })).toHaveAttribute("aria-pressed", "true");
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(screen.queryByRole("button", { name: /고사 연장 운행/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /학기\(금\)/ })).toHaveAttribute("aria-pressed", "true");
    view.unmount(); client.clear();
  });
});


it("keeps valid route rows when switching to an ordinary timetable after an incomplete bus response", () => {
  vi.useFakeTimers({ toFake: ["Date"] }); const data = fixture(); vi.setSystemTime(new Date(data.nowISO));
  data.buses = [null, ...buses] as unknown as typeof buses;
  const client = new QueryClient(); const view = render(content(client, data));
  fireEvent.click(screen.getByRole("button", { name: text.semesterMonThu }));
  expect(screen.getByRole("button", { name: /학교 ↔ 석계역.*펼치기/ })).toBeInTheDocument();
  view.unmount(); client.clear();
});
