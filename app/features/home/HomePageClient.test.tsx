import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientLocaleProvider } from "@/app/components/LocaleContext";
import { getDictionary, type Locale } from "@/lib/i18n";
import type { PublicHolidaySnapshot } from "@/types";
import { HomePageClient } from "./HomePageClient";
import { HomeSearchBar } from "./HomeSearchBar";

const api = vi.hoisted(() => ({
  fetchAnnouncementSummary: vi.fn(),
  fetchAnnouncements: vi.fn(),
  fetchAcademicSchedules: vi.fn(),
  fetchPublicHolidays: vi.fn(),
  fetchCafeteriaMenu: vi.fn(),
  fetchShuttleBuses: vi.fn(),
  fetchShuttleSpecialPeriods: vi.fn(),
  searchAll: vi.fn(),
}));
const navigation = vi.hoisted(() => ({
  push: vi.fn(), pathname: "/", params: new URLSearchParams(),
}));
const fetchServiceNotices = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => api);
vi.mock("@/lib/fetch-json", () => ({ fetchJson: fetchServiceNotices }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.params,
}));
vi.mock("@/lib/home", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/home")>(),
  getKoreaNow: () => new Date("2026-10-19T00:00:00.000Z"),
}));

const holidays: PublicHolidaySnapshot = {
  schemaVersion: 1, sourceUrl: "https://www.data.go.kr/data/15012690/openapi.do",
  lastSuccessAt: "2026-10-19T00:00:00.000Z", years: [2026],
  holidays: [{ date: "2026-10-19", names: ["검증 공휴일"] }],
};
let client: QueryClient;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  Object.values(api).forEach((reader) => reader.mockReset().mockResolvedValue([]));
  api.fetchPublicHolidays.mockResolvedValue(holidays);
  api.searchAll.mockResolvedValue({ items: [], failedSources: [] });
  fetchServiceNotices.mockReset().mockResolvedValue([]);
  navigation.push.mockReset();
  navigation.params = new URLSearchParams();
});

afterEach(() => {
  client.clear();
  expect(api.fetchCafeteriaMenu).not.toHaveBeenCalled();
  expect(api.fetchShuttleBuses).not.toHaveBeenCalled();
  expect(api.fetchShuttleSpecialPeriods).not.toHaveBeenCalled();
});

function renderHome(locale: Locale) {
  navigation.pathname = locale === "en" ? "/en" : "/";
  render(
    <ClientLocaleProvider locale={locale} dictionary={getDictionary(locale)}>
      <QueryClientProvider client={client}>
        <HomeSearchBar />
        <HomePageClient initialAnnouncements={[]} initialServiceNotices={[]}
          initialSchedules={[]} initialPublicHolidays={holidays}
          initialNowIso="2026-10-19T00:00:00.000Z" />
      </QueryClientProvider>
    </ClientLocaleProvider>,
  );
}

describe.each(["ko", "en"] as const)("home layout and data for %s", (locale) => {
  it("shows notices after six shortcuts and refreshes only the four displayed data sources", async () => {
    renderHome(locale);
    const dictionary = getDictionary(locale);
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      dictionary.home.frequentMenuTitle,
      dictionary.home.notices.title,
      dictionary.home.dashboard.todaySchedules,
      dictionary.home.relatedLinksTitle,
    ]);
    const prefix = locale === "en" ? "/en" : "";
    expect(screen.getByRole("link", { name: dictionary.home.menu.cafeteria })).toHaveAttribute("href", `${prefix}/campus/cafeteria`);
    expect(screen.getByRole("link", { name: dictionary.home.menu.bus })).toHaveAttribute("href", `${prefix}/campus/bus-info`);
    expect(screen.getByRole("heading", { name: "검증 공휴일" })).toBeInTheDocument();
    expect(client.getQueryCache().findAll({ type: "active" }).map((query) => query.queryKey[0]).sort()).toEqual([
      "announcements", "public-holidays", "schedules", "serviceNotices",
    ]);

    await act(async () => { await client.invalidateQueries(); });
    expect(api.fetchAnnouncementSummary).toHaveBeenCalledOnce();
    expect(fetchServiceNotices).toHaveBeenCalledOnce();
    expect(api.fetchAcademicSchedules).toHaveBeenCalledOnce();
    expect(api.fetchPublicHolidays).toHaveBeenCalledOnce();
    expect(api.searchAll).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: dictionary.home.notices.academic }));
    await waitFor(() => expect(api.fetchAnnouncements).toHaveBeenCalledWith("academic"));
    fireEvent.click(screen.getByRole("button", { name: dictionary.home.notices.service }));
    expect(screen.getByRole("button", { name: dictionary.home.notices.service })).toHaveAttribute("aria-pressed", "true");
  });

  it("preserves search, clearing, locale and unrelated query parameters", async () => {
    navigation.params = new URLSearchParams("search=library&from=shortcut");
    renderHome(locale);
    const dictionary = getDictionary(locale);
    const input = screen.getByRole("textbox", { name: dictionary.search.label });
    expect(input).toHaveValue("library");
    await waitFor(() => expect(api.searchAll).toHaveBeenCalledWith("library", expect.any(AbortSignal)));
    expect(screen.queryByRole("heading", { name: dictionary.home.frequentMenuTitle })).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "  bus  " } });
    fireEvent.submit(screen.getByRole("search"));
    expect(navigation.push).toHaveBeenLastCalledWith(`${navigation.pathname}?search=bus&from=shortcut`);
    fireEvent.click(screen.getByRole("button", { name: dictionary.search.resetToHome }));
    expect(navigation.push).toHaveBeenLastCalledWith(`${navigation.pathname}?from=shortcut`);
  });

  it("announces search loading without disabling clearing and removes busy status after completion", async () => {
    let finishSearch!: (result: { items: never[]; failedSources: never[] }) => void;
    api.searchAll.mockReturnValue(new Promise((resolve) => { finishSearch = resolve; }));
    navigation.params = new URLSearchParams("search=library");
    renderHome(locale);
    const dictionary = getDictionary(locale);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent(dictionary.errorBoundary.loading);
    expect(screen.getByRole("button", { name: dictionary.search.clear })).toBeEnabled();

    await act(async () => { finishSearch({ items: [], failedSources: [] }); });
    expect(await screen.findByRole("heading", { name: dictionary.search.noResultsTitle })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: dictionary.search.label })).toHaveValue("library");
  });
});
