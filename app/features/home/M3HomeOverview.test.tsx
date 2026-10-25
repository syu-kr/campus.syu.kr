import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ClientLocaleProvider } from "@/app/components/LocaleContext";
import { getDictionary } from "@/lib/i18n";
import { M3HomeOverview, type HomeOverviewData } from "./M3HomeOverview";

const api = vi.hoisted(() => ({
  fetchCafeteriaSnapshot: vi.fn(), fetchShuttleBuses: vi.fn(),
  fetchShuttleSpecialPeriods: vi.fn(), fetchPublicHolidays: vi.fn(),
}));
const fetchTransit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => api);
vi.mock("@/lib/fetch-json", () => ({ fetchJson: fetchTransit }));
const now = new Date("2026-10-19T00:00:00.000Z");
const initial: HomeOverviewData = {
  cafeteria: { menus: [], checkedAt: null, stale: true }, shuttles: [],
  specialPeriods: { specialPeriods: [], semesterPeriods: [], vacationPeriods: [] },
  holidays: { schemaVersion: 1, sourceUrl: "", lastSuccessAt: "", years: [2026], holidays: [] },
  updatedAt: now.getTime(),
};
let client: QueryClient;
const text = getDictionary("ko").home.overview;

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(now.getTime());
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  sessionStorage.clear();
  Object.values(api).forEach((reader) => reader.mockReset());
  fetchTransit.mockReset().mockResolvedValue({
    success: true, source: "public-transit-arrivals", data: [], timestamp: now.toISOString(), stale: false, sourceStatus: "fresh",
  });
});
afterEach(() => { client.clear(); vi.restoreAllMocks(); });

function view() {
  return <ClientLocaleProvider locale="ko" dictionary={getDictionary("ko")}>
    <QueryClientProvider client={client}>
      <M3HomeOverview now={now} schedules={[]} initial={initial}><p>schedule</p></M3HomeOverview>
    </QueryClientProvider>
  </ClientLocaleProvider>;
}

it("renders the same default choices on the server even when saved choices differ", () => {
  sessionStorage.setItem("campus-m3-home-restaurant", "manna");
  sessionStorage.setItem("campus-m3-home-transport", "transit");
  const read = vi.spyOn(Storage.prototype, "getItem");
  const html = renderToString(view());
  expect(html).toContain('aria-pressed="true">SU-Lounge');
  expect(html).not.toContain("<select");
  expect(read).not.toHaveBeenCalled();
  expect(fetchTransit).not.toHaveBeenCalled();
});

it("restores allowed choices after mounting without re-fetching fresh server snapshots", async () => {
  sessionStorage.setItem("campus-m3-home-transport", "transit");
  sessionStorage.setItem("campus-m3-home-stop", "humun-down");
  render(view());
  await waitFor(() => expect(screen.getByRole("button", { name: text.publicTransit })).toHaveAttribute("aria-pressed", "true"));
  expect(screen.getByRole("combobox", { name: text.busStop })).toHaveValue("humun-down");
  await waitFor(() => expect(fetchTransit).toHaveBeenCalledOnce());
  Object.values(api).forEach((reader) => expect(reader).not.toHaveBeenCalled());
  expect(sessionStorage.getItem("campus-m3-home-transport")).toBe("transit");
  expect(screen.getByRole("link", { name: /버스 정보/ })).toHaveAttribute("href", "/campus/bus-info?tab=public-transit&stop=humun-down");
  const transit = client.getQueryCache().find({ queryKey: ["public-transit-arrivals", "ko"] });
  expect(transit?.getObserversCount()).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: text.shuttle }));
  await act(async () => {});
  expect(transit?.getObserversCount()).toBe(0);
  expect(sessionStorage.getItem("campus-m3-home-transport")).toBe("shuttle");
});

it("keeps selection usable when browser storage is denied and ignores invalid stored values", async () => {
  sessionStorage.setItem("campus-m3-home-stop", "invalid-stop");
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
  render(view());
  fireEvent.click(screen.getByRole("button", { name: text.publicTransit }));
  await waitFor(() => expect(screen.getByRole("combobox", { name: text.busStop })).toHaveValue("jungmun-up"));
  fireEvent.change(screen.getByRole("combobox", { name: text.busStop }), { target: { value: "humun-up" } });
  expect(screen.getByRole("combobox", { name: text.busStop })).toHaveValue("humun-up");
  expect(read).toHaveBeenCalled();
  expect(write).toHaveBeenCalled();
});
