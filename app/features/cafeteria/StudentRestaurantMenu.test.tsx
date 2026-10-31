import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/app/components/LocaleProvider";
import { getDictionary, type Locale } from "@/lib/i18n";
import { StudentRestaurantMenu } from "./StudentRestaurantMenu";

const publicUrl = "https://example.github.io/data/cafeteria/student-restaurant-1.json";
const menu = {
  updatedAt: "2026-10-15T00:00:00Z",
  weekStart: "2026-10-12",
  days: [
    { date: "2026-10-12", breakfast: ["월요일 조식"], lunch: ["월요일 중식"], dinner: ["월요일 석식"] },
    { date: "2026-10-15", breakfast: [], lunch: ["목요일 중식"], dinner: null },
  ],
};
const cafeteriaText = getDictionary("ko").pages.cafeteria;
const text = cafeteriaText.studentRestaurant;
const clients: QueryClient[] = [];

function renderMenu(today = "2026-10-15", locale: Locale = "ko", firebaseDataEnabled = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <LocaleProvider locale={locale}>
        <StudentRestaurantMenu today={today} firebaseDataEnabled={firebaseDataEnabled} />
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

function mockJson(value: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => value });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CAFETERIA_JSON_URL", publicUrl);
  vi.stubGlobal("fetch", mockJson(menu));
});

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Manna House menu", () => {
  it.each(["2026-10-17", "2026-10-18"])("hides weekend meals even when published on %s", async today => {
    vi.stubGlobal("fetch", mockJson({ ...menu, days: [...menu.days,
      { date: today, breakfast: ["주말 조식"], lunch: ["주말 중식"], dinner: ["주말 석식"] }],
    }));
    renderMenu(today);
    expect(screen.getByText(cafeteriaText.weekendMessage)).toBeInTheDocument();
    expect(await screen.findByText("월요일 중식")).toBeInTheDocument();
    expect(screen.queryByText("주말 중식")).not.toBeInTheDocument();
    expect(screen.queryByText(cafeteriaText.missingToday)).not.toBeInTheDocument();
  });
  it("shows today's menu above the weekly menu and distinguishes closed from unreadable meals", async () => {
    renderMenu();
    expect(await screen.findByText("목요일 중식")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/public-data/student-restaurant-1.json", expect.objectContaining({
      cache: "no-store", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer",
    }));
    expect(screen.getByRole("region", { name: text.title })).toBeInTheDocument();
    expect(screen.queryByText(/마지막 정상 분석|Last successful analysis/)).not.toBeInTheDocument();
    expect(document.querySelector(`time[datetime="${menu.updatedAt}"]`)).toBeNull();
    expect(screen.queryByRole("button", { name: getDictionary("ko").home.overview.refresh })).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      cafeteriaText.todayMenu, cafeteriaText.weeklyMenu,
    ]);
    const today = screen.getByRole("region", { name: cafeteriaText.todayMenu });
    expect(today).toHaveAttribute("id", "today-menu");
    expect(within(today).getByText("목요일 중식")).toBeInTheDocument();
    expect(within(today).getByText(cafeteriaText.closedMeal)).toBeInTheDocument();
    expect(within(today).getByText(text.unknownMeal)).toBeInTheDocument();
    const weekly = screen.getByRole("region", { name: cafeteriaText.weeklyMenu });
    expect(within(weekly).getByText("월요일 조식")).toBeInTheDocument();
    expect(within(weekly).queryByText("목요일 중식")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "2026-10-12" })).not.toBeInTheDocument();
    expect(screen.queryByText(text.staleTitle)).not.toBeInTheDocument();
  });

  it("provides a keyboard-focusable weekly link back to today's menu", async () => {
    renderMenu();
    const redirect = await screen.findByRole("button", { name: cafeteriaText.todayMenuRedirect });
    const today = screen.getByRole("region", { name: cafeteriaText.todayMenu });
    const scrollIntoView = vi.fn();
    today.scrollIntoView = scrollIntoView;
    redirect.focus();
    expect(redirect).toHaveFocus();
    fireEvent.click(redirect);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("places the extraction notice first and labels historical official operating hours", async () => {
    renderMenu();
    const today = await screen.findByRole("region", { name: cafeteriaText.todayMenu });
    const note = screen.getByText(text.extractionNote);
    expect(note.compareDocumentPosition(today) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByText(text.extractionNote)).toHaveLength(1);
    for (const hours of ["07:40 ~ 08:50", "11:50 ~ 13:40", "17:00 ~ 18:30"]) {
      expect(screen.getByText(hours)).toBeInTheDocument();
    }
    expect(screen.getByText(text.hoursReference)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: text.hoursSource })).toHaveAttribute("href", "https://www.syu.ac.kr/dorm/?p=93424");
    expect(screen.getByText("아침")).toBeInTheDocument();
    expect(screen.getByText("점심")).toBeInTheDocument();
    expect(screen.getByText("저녁")).toBeInTheDocument();
    expect(screen.queryByText(/08:00/)).not.toBeInTheDocument();
    expect(screen.getByText(text.allergyMessage)).toBeInTheDocument();
    expect(within(today).getByRole("heading", { name: cafeteriaText.todayMenu })).toBeInTheDocument();
  });

  it("shows the original ingredients beside the right meal without labelling them as allergens", async () => {
    vi.stubGlobal("fetch", mockJson({
      ...menu,
      days: [{ ...menu.days[1], ingredients: { breakfast: [], lunch: ["밀", "우유,계란"], dinner: null } }],
    }));
    renderMenu();
    const today = screen.getByRole("region", { name: cafeteriaText.todayMenu });
    expect(await within(today).findByText("밀, 우유,계란")).toBeInTheDocument();
    expect(within(today).getAllByText(text.ingredientsTitle)).toHaveLength(3);
    expect(within(today).getByText(text.ingredientsNotListed)).toBeInTheDocument();
    expect(within(today).getByText(text.ingredientsUnavailable)).toBeInTheDocument();
    expect(screen.getByText(text.allergyMessage)).toBeInTheDocument();
  });

  it("shows a loading state until the public JSON arrives", async () => {
    let finish!: (value: unknown) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => { finish = resolve; })));
    renderMenu();
    expect(screen.getByRole("status", { name: text.loading })).toHaveAttribute("aria-busy", "true");
    finish({ ok: true, json: async () => menu });
    expect(await screen.findByText("목요일 중식")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: text.loading })).not.toBeInTheDocument();
  });

  it("hides a previous week's stored menus and warns instead of substituting them for today", async () => {
    renderMenu("2026-10-19");
    expect(await screen.findByText(text.staleTitle)).toBeInTheDocument();
    expect(screen.getByText(text.staleMessage)).toBeInTheDocument();
    expect(screen.getByText(cafeteriaText.missingToday)).toBeInTheDocument();
    expect(screen.queryByText("월요일 조식")).not.toBeInTheDocument();
    expect(screen.queryByText("목요일 중식")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /2026-10-/ })).not.toBeInTheDocument();
  });

  it("keeps earlier days from this week visible when today's menu is missing", async () => {
    renderMenu("2026-10-16");
    expect(await screen.findByText("월요일 조식")).toBeInTheDocument();
    expect(screen.getByText("목요일 중식")).toBeInTheDocument();
    const today = screen.getByRole("region", { name: cafeteriaText.todayMenu });
    expect(within(today).getByText(cafeteriaText.missingToday)).toBeInTheDocument();
    expect(within(today).queryByText("목요일 중식")).not.toBeInTheDocument();
    expect(screen.queryByText(text.staleTitle)).not.toBeInTheDocument();
  });

  it("hides a future week's stored menus until that week starts", async () => {
    renderMenu("2026-10-09");
    expect(await screen.findByText(text.upcomingTitle)).toBeInTheDocument();
    expect(screen.getByText(text.upcomingMessage)).toBeInTheDocument();
    expect(screen.getByText(cafeteriaText.missingToday)).toBeInTheDocument();
    expect(screen.queryByText("월요일 조식")).not.toBeInTheDocument();
    expect(screen.queryByText("목요일 중식")).not.toBeInTheDocument();
    expect(screen.queryByText(text.staleTitle)).not.toBeInTheDocument();
  });

  it.each([
    ["2026-10-15", "월요일 조식", "다음 주 조식"],
    ["2026-10-17", "다음 주 조식", "월요일 조식"],
    ["2026-10-18", "다음 주 조식", "월요일 조식"],
    ["2026-10-19", "다음 주 조식", "월요일 조식"],
  ])("shows only the display week from the same two-week publication on %s", async (today, visibleMeal, hiddenMeal) => {
    vi.stubGlobal("fetch", mockJson({
      ...menu, days: [...menu.days, { date: "2026-10-19", breakfast: ["다음 주 조식"], lunch: [], dinner: null }],
    }));
    renderMenu(today);
    expect(await screen.findByText(visibleMeal)).toBeInTheDocument();
    expect(screen.queryByText(hiddenMeal)).not.toBeInTheDocument();
    expect(screen.queryByText(text.staleTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(text.upcomingTitle)).not.toBeInTheDocument();
  });

  it("shows a next-week-only publication on Sunday and uses the weekend notice above it", async () => {
    vi.stubGlobal("fetch", mockJson({
      ...menu, weekStart: "2026-10-19", days: [
        { date: "2026-10-19", breakfast: ["다음 주 조식"], lunch: [], dinner: null },
      ],
    }));
    renderMenu("2026-10-18");

    expect(await screen.findByText("다음 주 조식")).toBeInTheDocument();
    expect(screen.getByText(cafeteriaText.weekendMessage)).toBeInTheDocument();
    expect(screen.queryByText(cafeteriaText.missingToday)).not.toBeInTheDocument();
    expect(screen.queryByText(text.upcomingTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(text.staleTitle)).not.toBeInTheDocument();
  });

  it("keeps this week's menu on Saturday when next week's menu has not arrived", async () => {
    renderMenu("2026-10-17");

    expect(await screen.findByText("월요일 조식")).toBeInTheDocument();
    expect(screen.getByText(cafeteriaText.weekendMessage)).toBeInTheDocument();
    expect(screen.queryByText(text.staleTitle)).not.toBeInTheDocument();
  });

  it("hides Sunday from today and the weekly menu while keeping weekday menus", async () => {
    vi.stubGlobal("fetch", mockJson({
      ...menu,
      days: [...menu.days, {
        date: "2026-10-18", breakfast: ["일요일 조식"], lunch: [], dinner: null,
      }],
    }));
    renderMenu("2026-10-18");
    expect(await screen.findByText("월요일 조식")).toBeInTheDocument();
    expect(screen.getByText(cafeteriaText.weekendMessage)).toBeInTheDocument();
    expect(screen.queryByText("일요일 조식")).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: cafeteriaText.weeklyMenu })).queryByRole("heading", { name: /일요일.*2026-10-18/ })).not.toBeInTheDocument();
    expect(screen.queryByText(text.staleTitle)).not.toBeInTheDocument();
  });

  it("shows the weekend notice while previewing only next week's weekdays below", async () => {
    vi.stubGlobal("fetch", mockJson({
      ...menu,
      days: [...menu.days,
        { date: "2026-10-18", breakfast: ["일요일 조식"], lunch: [], dinner: null },
        { date: "2026-10-19", breakfast: ["다음 주 조식"], lunch: [], dinner: null },
      ],
    }));
    renderMenu("2026-10-18");

    const today = screen.getByRole("region", { name: cafeteriaText.todayMenu });
    expect(within(today).getByText(cafeteriaText.weekendMessage)).toBeInTheDocument();
    const weekly = screen.getByRole("region", { name: cafeteriaText.weeklyMenu });
    expect(await within(weekly).findByText("다음 주 조식")).toBeInTheDocument();
    expect(within(weekly).queryByText("일요일 조식")).not.toBeInTheDocument();
    expect(screen.queryByText("월요일 조식")).not.toBeInTheDocument();
  });

  it("distinguishes a published empty menu from a fetch failure", async () => {
    vi.stubGlobal("fetch", mockJson({ ...menu, days: [] }));
    renderMenu();
    expect(await screen.findByText(text.empty)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports failed fetches and retries without inventing an analysis failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network failure"));
    vi.stubGlobal("fetch", fetchMock);
    renderMenu();
    expect(await screen.findByRole("alert")).toHaveTextContent(text.errorTitle);
    fetchMock.mockResolvedValue({ ok: true, json: async () => menu });
    fireEvent.click(screen.getByRole("button", { name: getDictionary("ko").home.dashboard.retry }));
    expect(await screen.findByText("목요일 중식")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("rejects invalid public data", async () => {
    vi.stubGlobal("fetch", mockJson({ ...menu, days: [{ date: "2026-10-15", lunch: ["불완전한 식단"] }] }));
    renderMenu();
    expect(await screen.findByRole("alert")).toHaveTextContent(text.errorTitle);
    expect(screen.queryByText("불완전한 식단")).not.toBeInTheDocument();
  });

  it("does not fetch when the public URL is not configured", () => {
    vi.stubEnv("NEXT_PUBLIC_CAFETERIA_JSON_URL", "");
    renderMenu();
    expect(screen.getByText(text.notConfigured)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["", "https://retired.example/unused"])("loads Firebase menu without a usable legacy URL (%s)", async (url) => {
    vi.stubEnv("NEXT_PUBLIC_CAFETERIA_JSON_URL", url);
    renderMenu("2026-10-15", "ko", true);
    expect(await screen.findByText("목요일 중식")).toBeInTheDocument();
    expect(screen.queryByText(text.notConfigured)).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/public-data/student-restaurant-1.json", expect.objectContaining({ credentials: "omit", redirect: "error" }));
  });

  it("keeps retry available if Firebase is configured but unavailable without a legacy URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_CAFETERIA_JSON_URL", "");
    const fetchMock = vi.fn().mockRejectedValue(new Error("unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    renderMenu("2026-10-15", "ko", true);
    expect(await screen.findByRole("alert")).toHaveTextContent(text.errorTitle);
    expect(screen.queryByText(text.notConfigured)).not.toBeInTheDocument();
    fetchMock.mockResolvedValue({ ok: true, json: async () => menu });
    fireEvent.click(screen.getByRole("button", { name: getDictionary("ko").home.dashboard.retry }));
    expect(await screen.findByText("목요일 중식")).toBeInTheDocument();
  });

  it.each([
    "http://example.github.io/cafeteria/student-restaurant-1.json",
    "https://example.github.io/private-endpoint",
    `${publicUrl}?token=example`,
    "https://name:password@example.github.io/cafeteria/student-restaurant-1.json",
  ])("rejects an unsafe or incorrect public JSON URL without requesting it (%s)", async (url) => {
    vi.stubEnv("NEXT_PUBLIC_CAFETERIA_JSON_URL", url);
    renderMenu();
    expect(await screen.findByRole("alert")).toHaveTextContent(text.errorTitle);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses English labels for the cafeteria and both menu sections", async () => {
    renderMenu("2026-10-15", "en");
    expect(await screen.findByText("목요일 중식")).toBeInTheDocument();
    const english = getDictionary("en").pages.cafeteria;
    expect(screen.getByRole("region", { name: english.studentRestaurant.title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: english.todayMenu })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: english.weeklyMenu })).toBeInTheDocument();
    expect(screen.getByText("Menu unavailable")).toBeInTheDocument();
  });
});
