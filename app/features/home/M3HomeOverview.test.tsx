import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ClientLocaleProvider } from "@/app/components/LocaleContext";
import { getDictionary, type Locale } from "@/lib/i18n";
import { toCafeteriaMenus } from "@/lib/cafeteria";
import shuttles from "@/public/data/shuttle-bus-schedule.json";
import { M3HomeOverview, type HomeOverviewData } from "./M3HomeOverview";

const weatherApi = vi.hoisted(() => ({ fetchWeather: vi.fn() }));
vi.mock("@/lib/weather", () => ({ fetchWeather: weatherApi.fetchWeather, WEATHER_REFRESH_INTERVAL_MS: 300_000 }));
const cachedWeather = {
  temperature: 14, skyCondition: 4, precipitation: 0, windSpeed: 1,
  time: "2026-10-19 09:00", latitude: 37.64, longitude: 127.11, gridX: 61, gridY: 128,
  source: "KMA", timestamp: "2026-10-19T09:00:00+09:00", stale: false, sourceStatus: "fresh",
};

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
  weatherApi.fetchWeather.mockReset().mockResolvedValue(cachedWeather);
  client.setQueryData(["weather"], cachedWeather);
  Object.values(api).forEach((reader) => reader.mockReset());
  fetchTransit.mockReset().mockResolvedValue({
    success: true, source: "public-transit-arrivals", data: [], timestamp: now.toISOString(), stale: false, sourceStatus: "fresh",
  });
});
afterEach(() => { client.clear(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

function view(locale: Locale = "ko", data: HomeOverviewData = initial, at: Date = now) {
  return <ClientLocaleProvider locale={locale} dictionary={getDictionary(locale)}>
    <QueryClientProvider client={client}>
      <M3HomeOverview now={at} initial={data}><p>schedule</p></M3HomeOverview>
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
  expect(screen.getByRole("combobox", { name: text.busStop })).toHaveAttribute("data-value", "humun-down");
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
  const trigger = await screen.findByRole("combobox", { name: text.busStop });
  expect(trigger).toHaveAttribute("data-value", "jungmun-up");
  fireEvent.click(trigger);
  const option = await screen.findByRole("option", { name: getDictionary("ko").pages.busInfo.stopLabels.humunUp });
  fireEvent.pointerDown(option);
  fireEvent.click(option);
  expect(trigger).toHaveAttribute("data-value", "humun-up");
  expect(read).toHaveBeenCalled();
  expect(write).toHaveBeenCalled();
});

it.each(["ko", "en"] as const)("uses the shared stop popup and preserves choices, focus and detail navigation in %s", async (locale) => {
  const dictionary = getDictionary(locale), overview = dictionary.home.overview, labels = dictionary.pages.busInfo.stopLabels;
  render(view(locale));
  fireEvent.click(screen.getByRole("button", { name: overview.publicTransit }));
  const trigger = screen.getByRole("combobox", { name: overview.busStop });
  expect(trigger).toHaveAttribute("data-variant", "tonal");
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  const options = await screen.findAllByRole("option");
  expect(options.map(option => option.textContent)).toEqual([labels.jungmunUp, labels.jungmunDown, labels.humunUp, labels.humunDown]);
  expect(options[0]).toHaveAttribute("aria-selected", "true");
  fireEvent.keyDown(options[0], { key: "Escape" });
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(trigger);
  const next = await screen.findByRole("option", { name: labels.humunDown });
  fireEvent.pointerDown(next);
  fireEvent.click(next);
  expect(trigger).toHaveAttribute("data-value", "humun-down");
  expect(sessionStorage.getItem("campus-m3-home-stop")).toBe("humun-down");
  expect(screen.getByRole("link", { name: new RegExp(overview.busInfo) })).toHaveAttribute("href", `${locale === "en" ? "/en" : ""}/campus/bus-info?tab=public-transit&stop=humun-down`);
});


function operatingData(at: Date): HomeOverviewData {
  return {
    ...initial,
    shuttles: shuttles,
    specialPeriods: {
      specialPeriods: [], vacationPeriods: [],
      semesterPeriods: [{ id: "fall", name: "Fall", startDate: "2026-09-01", endDate: "2026-12-31", scheduleType: "semester" }],
    },
    holidays: { schemaVersion: 1, sourceUrl: "https://www.data.go.kr/data/15012690/openapi.do", lastSuccessAt: at.toISOString(), years: [2026], holidays: [] },
  };
}

it.each([
  ["ko", "2026년 10월 19일 월요일"],
  ["en", "Monday, October 19, 2026"],
] as const)("includes the year and weekday in the %s campus date", (locale, expected) => {
  render(view(locale));
  expect(screen.getByText(expected).tagName).toBe("TIME");
  expect(screen.getByText(expected)).toHaveAttribute("dateTime", now.toISOString());
  expect(weatherApi.fetchWeather).not.toHaveBeenCalled();
});

it("shows each regular route's next departure instead of one global first departure", () => {
  const at = new Date("2026-10-26T08:00:00+09:00");
  render(view("ko", operatingData(at), at));
  const list = screen.getByRole("list", { name: text.shuttleDepartures });
  expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  shuttles.forEach((bus) => expect(within(list).getByText(bus.routeName)).toBeInTheDocument());
  expect(within(list).getByText("08:10 예정 출발")).toBeInTheDocument();
  expect(within(list).getByText("12:00 예정 출발")).toBeInTheDocument();
  expect(within(list).getByText("08:30 예정 출발")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: text.busTitle }).closest("section")!.querySelector(".m3-home-status")).toBeNull();
});

it("retains each route after its last departure without claiming service is closed", () => {
  const at = new Date("2026-10-26T20:00:00+09:00");
  render(view("ko", operatingData(at), at));
  const list = screen.getByRole("list", { name: text.shuttleDepartures });
  expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  expect(within(list).getAllByText(text.shuttleNextNone)).toHaveLength(3);
  expect(screen.queryByText(text.serviceClosed)).not.toBeInTheDocument();
});

it("preserves the holiday and unconfirmed-operation decisions instead of showing regular route predictions", () => {
  const at = new Date("2026-10-26T08:00:00+09:00");
  const data = operatingData(at);
  data.holidays!.holidays = [{ date: "2026-10-26", names: ["Test holiday"] }];
  const { unmount } = render(view("ko", data, at));
  expect(screen.getByText(text.serviceClosed)).toBeInTheDocument();
  expect(screen.queryByRole("list", { name: text.shuttleDepartures })).not.toBeInTheDocument();
  unmount();
  client.clear();
  client.setQueryData(["weather"], cachedWeather);
  const unknown = operatingData(at);
  unknown.holidays!.stale = true;
  render(view("ko", unknown, at));
  expect(screen.getByText(text.serviceUnconfirmed)).toBeInTheDocument();
  expect(screen.queryByRole("list", { name: text.shuttleDepartures })).not.toBeInTheDocument();
});

it("keeps a special interval notice separate from regular next-departure rows", () => {
  const at = new Date("2026-10-26T08:00:00+09:00");
  const data = operatingData(at);
  data.specialPeriods!.specialPeriods = [{
    id: "special-window", name: "Special service", startDate: "2026-10-26", endDate: "2026-10-26",
    description: "Verified special interval", applicableDates: ["2026-10-26"], routes: [],
    daytimeIntervals: { changeTime: "13:00", beforeMinutes: 15, afterMinutes: 30 },
  }];
  render(view("ko", data, at));
  expect(screen.getByText(text.specialService)).toBeInTheDocument();
  expect(screen.queryByRole("list", { name: text.shuttleDepartures })).not.toBeInTheDocument();
});

it("preserves verified exception service instead of implying all regular routes operate", () => {
  const at = new Date("2026-10-26T08:00:00+09:00");
  const data = operatingData(at);
  data.specialPeriods!.serviceExceptions = [{
    date: "2026-10-26", routeId: shuttles[0].id, times: ["08:20"],
    sourceUrl: "https://www.syu.ac.kr/notice/", verifiedAt: "2026-10-25T00:00:00Z",
  }];
  render(view("ko", data, at));
  expect(screen.getByText(shuttles[0].routeName)).toBeInTheDocument();
  expect(screen.queryByRole("list", { name: text.shuttleDepartures })).not.toBeInTheDocument();
});

it.each([false, true])("does not offer forced refresh for a normal or retained meal or static shuttle (stale: %s)", (stale) => {
  const data = { ...initial, cafeteria: {
    menus: toCafeteriaMenus([{ date: "2026-10-19", day: "월", meals: { lunch: ["Actual meal"] } }]),
    checkedAt: now.toISOString(), stale,
  } };
  render(view("ko", data));
  if (!stale) {
    const meal = within(screen.getByRole("heading", { name: text.mealTitle }).closest("section")!);
    expect(meal.queryByRole("status")).not.toBeInTheDocument();
  }
  expect(screen.queryByRole("button", { name: text.refresh })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: getDictionary("ko").home.dashboard.retry })).not.toBeInTheDocument();
});

it("retains meal error recovery without adding a regular refresh action", async () => {
  api.fetchCafeteriaSnapshot.mockRejectedValueOnce(new Error("offline"));
  render(view());
  await act(async () => { await client.invalidateQueries({ queryKey: ["cafeteria-weekly-snapshot"] }); });
  const meal = within(screen.getByRole("heading", { name: text.mealTitle }).closest("section")!);
  const retry = await meal.findByRole("button", { name: getDictionary("ko").home.dashboard.retry });
  expect(screen.queryByRole("button", { name: text.refresh })).not.toBeInTheDocument();
  api.fetchCafeteriaSnapshot.mockResolvedValue(initial.cafeteria);
  fireEvent.click(retry);
  await waitFor(() => expect(meal.queryByRole("button", { name: getDictionary("ko").home.dashboard.retry })).not.toBeInTheDocument());
  expect(api.fetchCafeteriaSnapshot).toHaveBeenCalledTimes(2);
});

it("retains a failed static-shuttle lookup retry but no regular refresh", async () => {
  api.fetchShuttleBuses.mockRejectedValueOnce(new Error("offline"));
  render(view());
  await act(async () => { await client.invalidateQueries({ queryKey: ["shuttle-buses"] }); });
  const bus = within(screen.getByRole("heading", { name: text.busTitle }).closest("section")!);
  const retry = await bus.findByRole("button", { name: getDictionary("ko").home.dashboard.retry });
  expect(bus.queryByRole("button", { name: text.refresh })).not.toBeInTheDocument();
  api.fetchShuttleBuses.mockResolvedValue(initial.shuttles);
  api.fetchShuttleSpecialPeriods.mockResolvedValue(initial.specialPeriods);
  api.fetchPublicHolidays.mockResolvedValue(initial.holidays);
  fireEvent.click(retry);
  await waitFor(() => expect(bus.queryByRole("button", { name: getDictionary("ko").home.dashboard.retry })).not.toBeInTheDocument());
  expect(api.fetchShuttleBuses).toHaveBeenCalledTimes(2);
  expect(api.fetchShuttleSpecialPeriods).toHaveBeenCalledOnce();
  expect(api.fetchPublicHolidays).toHaveBeenCalledOnce();
});

it("keeps manual refresh for actual transit arrivals and leaves static queries alone", async () => {
  render(view());
  fireEvent.click(screen.getByRole("button", { name: text.publicTransit }));
  await waitFor(() => expect(fetchTransit).toHaveBeenCalledOnce());
  const refresh = await screen.findByRole("button", { name: text.refresh });
  await waitFor(() => expect(refresh).toBeEnabled());
  expect(screen.getByRole("heading", { name: text.busTitle }).closest("section")!.querySelector(".m3-home-status [role=status]")).toBeNull();
  fireEvent.click(refresh);
  await waitFor(() => expect(fetchTransit).toHaveBeenCalledTimes(2));
  Object.values(api).forEach((reader) => expect(reader).not.toHaveBeenCalled());
});

it.each(["fresh", "missing", "loading"] as const)("does not offer forced refresh for the Manna %s state", async (state) => {
  const publicUrl = "https://example.github.io/data/cafeteria/student-restaurant-1.json";
  vi.stubEnv("NEXT_PUBLIC_CAFETERIA_JSON_URL", publicUrl);
  if (state === "loading") fetchTransit.mockReturnValue(new Promise(() => {}));
  else client.setQueryData(["student-restaurant", publicUrl], {
    updatedAt: now.toISOString(), weekStart: "2026-10-19",
    days: [{ date: state === "missing" ? "2026-10-18" : "2026-10-19", breakfast: [], lunch: ["Manna lunch"], dinner: [] }],
  });
  render(view());
  fireEvent.click(screen.getByRole("button", { name: getDictionary("ko").pages.cafeteria.mannaTab }));
  expect(screen.queryByRole("button", { name: text.refresh })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: getDictionary("ko").home.dashboard.retry })).not.toBeInTheDocument();
  if (state === "loading") expect(screen.getByText(text.mealLoading)).toBeInTheDocument();
  else expect(fetchTransit).not.toHaveBeenCalled();
});

it("retains Manna error recovery and removes retry after a successful response", async () => {
  const publicUrl = "https://example.github.io/data/cafeteria/student-restaurant-1.json";
  vi.stubEnv("NEXT_PUBLIC_CAFETERIA_JSON_URL", publicUrl);
  client.setQueryDefaults(["student-restaurant", publicUrl], { retryDelay: 0 });
  fetchTransit.mockRejectedValue(new Error("offline"));
  render(view());
  fireEvent.click(screen.getByRole("button", { name: getDictionary("ko").pages.cafeteria.mannaTab }));
  const retry = await screen.findByRole("button", { name: getDictionary("ko").home.dashboard.retry });
  expect(screen.queryByRole("button", { name: text.refresh })).not.toBeInTheDocument();
  let finish!: (value: unknown) => void;
  fetchTransit.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  retry.focus();
  fireEvent.click(retry);
  await waitFor(() => expect(retry).toBeDisabled());
  expect(retry).toHaveFocus();
  expect(screen.getByText(text.mealLoading)).toBeInTheDocument();
  await act(async () => finish({
    updatedAt: now.toISOString(), weekStart: "2026-10-19",
    days: [{ date: "2026-10-19", breakfast: [], lunch: ["Recovered Manna lunch"], dinner: [] }],
  }));
  expect(await screen.findByText("Recovered Manna lunch")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: getDictionary("ko").home.dashboard.retry })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: text.refresh })).not.toBeInTheDocument();
});

it("loads Firebase Manna from a restored home choice without the legacy URL", async () => {
  vi.stubEnv("NEXT_PUBLIC_CAFETERIA_JSON_URL", "");
  sessionStorage.setItem("campus-m3-home-restaurant", "manna");
  fetchTransit.mockResolvedValue({
    updatedAt: now.toISOString(), weekStart: "2026-10-19",
    days: [{ date: "2026-10-19", breakfast: [], lunch: ["Firebase Manna lunch"], dinner: [] }],
  });
  render(view("ko", { ...initial, firebaseDataEnabled: true }));
  expect(await screen.findByText("Firebase Manna lunch")).toBeInTheDocument();
  expect(fetchTransit).toHaveBeenCalledWith("/api/public-data/student-restaurant-1.json", expect.objectContaining({ credentials: "omit", redirect: "error" }));
  expect(screen.queryByText(getDictionary("ko").pages.cafeteria.studentRestaurant.notConfigured)).not.toBeInTheDocument();
});

it.each(["ko", "en"] as const)("uses the shared weather sentence as the only introduction heading in %s", (locale) => {
  const { container } = render(view(locale));
  const dictionary = getDictionary(locale);
  const expected = dictionary.home.overview.weather.current
    .replace("{temperature}", String(cachedWeather.temperature))
    .replace("{description}", dictionary.weather.cloudy);
  const heading = screen.getByRole("heading", { level: 1, name: expected });
  expect(container.querySelectorAll(".m3-home-weather")).toHaveLength(1);
  expect(heading.querySelector('[role="status"]')).toHaveAttribute("data-weather-state", "fresh");
  const date = container.querySelector(".m3-home-date")!;
  expect(date.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(weatherApi.fetchWeather).not.toHaveBeenCalled();
});

it("keeps the weather introduction and useful cafeteria weekend notice on weekends", () => {
  const at = new Date("2026-10-25T09:00:00+09:00");
  const { container } = render(view("ko", initial, at));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("현재 캠퍼스 날씨는 14°C에 흐림입니다.");
  expect(container.querySelectorAll(".m3-home-weather")).toHaveLength(1);
  expect(screen.getByText(getDictionary("ko").pages.cafeteria.weekendMessage)).toBeInTheDocument();
});
