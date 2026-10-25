import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/app/components/LocaleProvider";
import { fetchCafeteriaSnapshot } from "@/lib/api";
import { toCafeteriaMenus, type CafeteriaSnapshot } from "@/lib/cafeteria";
import { getDictionary, type Locale } from "@/lib/i18n";
import type { CafeteriaMenu } from "@/types";
import { CafeteriaPageClient } from "./CafeteriaPageClient";

vi.mock("@/lib/api", () => ({ fetchCafeteriaSnapshot: vi.fn() }));
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    usePathname: () => "/campus/cafeteria",
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(
      (listener) => { window.addEventListener("popstate", listener); return () => window.removeEventListener("popstate", listener); },
      () => window.location.search,
      () => window.location.search,
    )),
  };
});
const replaceHistory = window.history.replaceState.bind(window.history);

vi.mock("@/app/features/cafeteria/StudentRestaurantMenu", () => ({
  StudentRestaurantMenu: ({ today }: { today: string }) => (
    <div data-testid="manna-menu">Manna menu for {today}</div>
  ),
}));

const text = getDictionary("ko").pages.cafeteria;
const checkedAt = "2026-10-15T01:00:00Z";
const initialNowIso = "2026-10-15T03:00:00Z";
const snapshot: CafeteriaSnapshot = {
  menus: toCafeteriaMenus([{ date: "2026-10-15", day: "목", meals: { lunch: ["비빔밥"] } }]),
  checkedAt,
  stale: false,
};
const clients: QueryClient[] = [];

function page(data = snapshot, locale: Locale = "ko", now = initialNowIso) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return {
    client,
    tree: <QueryClientProvider client={client}><LocaleProvider locale={locale}>
      <CafeteriaPageClient initialSnapshot={data} initialNowIso={now} />
    </LocaleProvider></QueryClientProvider>,
  };
}

beforeEach(() => {
  window.history.replaceState({}, "", "/campus/cafeteria");
  vi.spyOn(window.history, "replaceState").mockImplementation((...args) => {
    replaceHistory(...args);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(new Date(initialNowIso));
  vi.mocked(fetchCafeteriaSnapshot).mockReset().mockResolvedValue(snapshot);
});
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  vi.useRealTimers();
});

describe("cafeteria menu content and sources", () => {
  it.each(["ko", "en"] as const)("renders the initial menu once and places source links after the notices in %s", (locale) => {
    const dictionary = getDictionary(locale);
    const { tree } = page(snapshot, locale);
    const container = document.createElement("div");
    container.innerHTML = renderToString(tree);
    const view = within(container);
    const source = view.getByRole("link", { name: dictionary.pages.cafeteria.answer.source });
    const notice = view.getByText(dictionary.pages.cafeteria.noticeTitle);

    expect(view.queryByRole("button", { name: dictionary.home.overview.refresh })).toBeNull();
    expect(view.getAllByText("비빔밥")).toHaveLength(1);
    expect(view.getByRole("heading", { name: dictionary.pages.cafeteria.todayMenu })).not.toBeNull();
    expect(source).toHaveAttribute("href", "https://www.syu.ac.kr/school-life/facility-information/cafeteria/");
    expect(notice.compareDocumentPosition(source) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(view.queryByText(dictionary.pages.cafeteria.answer.title)).toBeNull();
    expect(view.queryByText(dictionary.pages.cafeteria.answer.question)).toBeNull();
    expect(view.queryByText(dictionary.answerSummary.basisLabel, { exact: false })).toBeNull();
    expect(view.queryByText(dictionary.answerSummary.unknownCheckedAt, { exact: false })).toBeNull();
    expect(container.querySelector("time, [data-answer-text], #cafeteria-answer-schema")).toBeNull();
  });

  it("updates today's menu after a refetch without adding a duplicate summary", async () => {
    const { tree, client } = page();
    const { container } = render(tree);
    const nextCheckedAt = "2026-10-15T03:01:00Z";
    vi.setSystemTime(new Date(nextCheckedAt));
    vi.mocked(fetchCafeteriaSnapshot).mockResolvedValueOnce({
      ...snapshot, checkedAt: nextCheckedAt,
      menus: toCafeteriaMenus([{ date: "2026-10-15", day: "목", meals: { lunch: ["칼국수"] } }]),
    });
    await act(async () => { await client.invalidateQueries({ queryKey: ["cafeteria-weekly-snapshot"] }); });
    await waitFor(() => expect(screen.getByText("칼국수")).toBeInTheDocument());
    expect(screen.getAllByText("칼국수")).toHaveLength(1);
    expect(screen.queryByText("비빔밥")).not.toBeInTheDocument();
    expect(container.querySelector("[data-answer-text], #cafeteria-answer-schema")).toBeNull();
  });

  it("keeps retained menus qualified after a failed refetch and preserves manual retry", async () => {
    const { tree, client } = page();
    const { container } = render(tree);
    vi.mocked(fetchCafeteriaSnapshot).mockRejectedValueOnce(new Error("offline"));
    await act(async () => { await client.invalidateQueries({ queryKey: ["cafeteria-weekly-snapshot"] }); });
    await waitFor(() => expect(screen.getByText(getDictionary("ko").home.dashboard.loadFailedTitle)).toBeInTheDocument());
    expect(screen.getAllByRole("status").some((status) => status.textContent?.includes(text.staleMenuMessage))).toBe(true);
    expect(screen.getByRole("button", { name: getDictionary("ko").home.dashboard.retry })).toBeVisible();
    expect(screen.queryByText("비빔밥")).not.toBeInTheDocument();
    expect(container.querySelector("time")).toBeNull();
  });

  it("warns about stale data and keeps unknown source confirmation times hidden", () => {
    const { tree } = page({ ...snapshot, checkedAt: null, stale: true });
    const { container } = render(tree);
    expect(screen.getAllByRole("status").some((status) => status.textContent?.includes(text.staleMenuMessage))).toBe(true);
    expect(screen.queryByText(new RegExp(getDictionary("ko").answerSummary.unknownCheckedAt))).not.toBeInTheDocument();
    expect(screen.queryByText("비빔밥")).not.toBeInTheDocument();
    expect(container.querySelector(`time[datetime='${checkedAt}']`)).toBeNull();
  });

  it("changes today's menu on Korea midnight using the same weekly menus", () => {
    const now = "2026-10-15T14:59:00Z";
    vi.setSystemTime(new Date(now));
    const { tree } = page({
      ...snapshot,
      menus: [...snapshot.menus, ...toCafeteriaMenus([{ date: "2026-10-16", day: "금", meals: { lunch: ["볶음밥"] } }])],
    }, "ko", now);
    const { container } = render(tree);
    const today = within(container.querySelector<HTMLElement>("#today-menu")!);
    expect(today.getByText("비빔밥")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(today.getByText("2026-10-16")).toBeInTheDocument();
    expect(today.getByText("볶음밥")).toBeInTheDocument();
    expect(today.queryByText("비빔밥")).not.toBeInTheDocument();
  });
});

function menu(date: string, dayOfWeek: string, name: string): CafeteriaMenu {
  return {
    id: date,
    date,
    dayOfWeek,
    breakfast: [],
    lunch: { a: [{ name }] },
    dinner: [],
    location: "SU-Lounge",
  };
}

const menus = [
  menu("2026-10-11", "일", "지난주 일요일 메뉴"),
  menu("2026-10-12", "월", "이번 주 월요일 메뉴"),
  menu("2026-10-15", "목", "오늘의 SU 메뉴"),
  menu("2026-10-18", "일", "이번 주 일요일 메뉴"),
  menu("2026-10-19", "월", "다음 주 월요일 메뉴"),
];

function renderPage(initialMenus = menus, locale: Locale = "ko") {
  const { tree } = page({ ...snapshot, menus: initialMenus }, locale);
  return render(tree);
}

describe("cafeteria selection and weekly menu", () => {
  it("opens Manna House from a home link and allows switching back to SU-Lounge", () => {
    window.history.replaceState({}, "", "/campus/cafeteria?restaurant=manna&lang=en");
    renderPage();
    const selector = screen.getByRole("group", { name: text.restaurantPicker });
    const manna = within(selector).getByRole("button", { name: text.mannaTab });
    expect(manna).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("manna-menu")).toBeInTheDocument();
    fireEvent.click(within(selector).getByRole("button", { name: text.suLoungeTitle }));
    expect(window.location.search).toContain("restaurant=su-lounge");
    expect(window.location.search).toContain("lang=en");
    expect(manna).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("오늘의 SU 메뉴")).toBeInTheDocument();
  });

  it("defaults to SU-Lounge and shows today's menu above only the current week's menus", () => {
    renderPage();

    const selector = screen.getByRole("group", { name: "식당 선택" });
    const suLounge = within(selector).getByRole("button", { name: "SU-Lounge" });
    expect(suLounge).toHaveAttribute("aria-pressed", "true");
    expect(suLounge).toHaveAttribute("aria-controls", "cafeteria-panel");
    expect(within(selector).getByRole("button", { name: "만나의 집" }))
      .toHaveAttribute("aria-pressed", "false");
    expect(document.getElementById("cafeteria-panel")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: text.title })).toBeInTheDocument();
    expect(screen.queryByTestId("manna-menu")).not.toBeInTheDocument();

    const todayHeading = screen.getByRole("heading", { name: text.todayMenu });
    const weeklyHeading = screen.getByRole("heading", { name: text.weeklyMenu });
    expect(todayHeading.compareDocumentPosition(weeklyHeading) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(screen.getByText("오늘의 SU 메뉴")).toBeInTheDocument();
    expect(screen.getByText("이번 주 월요일 메뉴")).toBeInTheDocument();
    expect(screen.getByText("이번 주 일요일 메뉴")).toBeInTheDocument();
    expect(screen.queryByText("지난주 일요일 메뉴")).not.toBeInTheDocument();
    expect(screen.queryByText("다음 주 월요일 메뉴")).not.toBeInTheDocument();
  });

  it("shows only the selected restaurant and restores SU-Lounge when selected again", () => {
    const { container } = renderPage();
    const selector = screen.getByRole("group", { name: "식당 선택" });
    const manna = within(selector).getByRole("button", { name: "만나의 집" });
    manna.focus();
    expect(manna).toHaveFocus();
    fireEvent.click(manna);

    expect(manna).toHaveAttribute("aria-pressed", "true");
    expect(manna).toHaveAttribute("aria-controls", "cafeteria-panel");
    expect(screen.getByTestId("manna-menu")).toHaveTextContent("Manna menu for 2026-10-15");
    expect(screen.queryByText("오늘의 SU 메뉴")).not.toBeInTheDocument();
    expect(screen.queryByText(text.operationHours)).not.toBeInTheDocument();
    expect(container.querySelector("[data-answer-text]")).toBeNull();
    expect(container.querySelector("#cafeteria-answer-schema")).toBeNull();
    expect(screen.queryByRole("link", { name: text.answer.source })).not.toBeInTheDocument();

    const suLounge = within(selector).getByRole("button", { name: "SU-Lounge" });
    expect(suLounge).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(suLounge);
    expect(suLounge).toHaveAttribute("aria-pressed", "true");
    expect(manna).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("오늘의 SU 메뉴")).toBeInTheDocument();
    expect(screen.queryByTestId("manna-menu")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: text.answer.source })).toBeInTheDocument();
  });

  it("keeps previous-week menus hidden and warns when current-week data is unavailable", () => {
    renderPage([menus[0]]);

    expect(screen.queryByText("지난주 일요일 메뉴")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: text.weeklyMenu })).toBeInTheDocument();
    expect(screen.getAllByRole("status").some((status) => status.textContent?.includes(text.staleMenuMessage)))
      .toBe(true);
  });

  it("keeps fresh same-week menus visible when today's menu is missing", () => {
    renderPage([menus[1]]);

    const weeklySection = screen.getByRole("region", { name: text.weeklyMenu });
    expect(within(weeklySection).getByText("이번 주 월요일 메뉴")).toBeInTheDocument();
    expect(screen.queryByText("오늘의 SU 메뉴")).not.toBeInTheDocument();
  });

  it.each(["2026-10-17", "2026-10-18"])("shows next week's published menu on %s without an update warning", (today) => {
    const now = `${today}T03:00:00Z`;
    vi.setSystemTime(new Date(now));
    const { tree } = page({ ...snapshot, menus }, "ko", now);
    render(tree);

    const weekly = screen.getByRole("region", { name: text.weeklyMenu });
    expect(within(weekly).getByText("다음 주 월요일 메뉴")).toBeInTheDocument();
    expect(within(weekly).queryByText("이번 주 월요일 메뉴")).not.toBeInTheDocument();
    expect(screen.getByText(text.weekendMessage)).toBeInTheDocument();
    expect(screen.queryByText(text.staleMenuTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(text.pendingTitle)).not.toBeInTheDocument();
  });

  it("shows next week's menu even when only that week has been published on Sunday", () => {
    const now = "2026-10-18T03:00:00Z";
    vi.setSystemTime(new Date(now));
    const { tree } = page({ ...snapshot, menus: [menus[4]] }, "ko", now);
    render(tree);

    expect(screen.getByText("다음 주 월요일 메뉴")).toBeInTheDocument();
    expect(screen.queryByText(text.staleMenuTitle)).not.toBeInTheDocument();
  });

  it("keeps this week's menu on Sunday when next week's menu has not arrived", () => {
    const now = "2026-10-18T03:00:00Z";
    vi.setSystemTime(new Date(now));
    const { tree } = page({ ...snapshot, menus: menus.slice(0, 4) }, "ko", now);
    render(tree);

    expect(screen.getByText("이번 주 월요일 메뉴")).toBeInTheDocument();
    expect(screen.getByText("이번 주 일요일 메뉴")).toBeInTheDocument();
    expect(screen.queryByText(text.staleMenuTitle)).not.toBeInTheDocument();
  });

  it("hides current-week menu cards when the source snapshot is stale", () => {
    const { tree } = page({ ...snapshot, menus, stale: true });
    render(tree);

    expect(screen.getAllByRole("status").some((status) => status.textContent?.includes(text.staleMenuMessage))).toBe(true);
    expect(screen.queryByText("오늘의 SU 메뉴")).not.toBeInTheDocument();
    expect(screen.queryByText("이번 주 월요일 메뉴")).not.toBeInTheDocument();
    expect(screen.queryByText("이번 주 일요일 메뉴")).not.toBeInTheDocument();
  });

  it("uses English labels for restaurant selection", () => {
    renderPage(menus, "en");
    const selector = screen.getByRole("group", { name: "Choose a cafeteria" });
    expect(within(selector).getByRole("button", { name: "SU-Lounge" })).toBeInTheDocument();
    fireEvent.click(within(selector).getByRole("button", { name: "Manna House" }));
    expect(screen.getByTestId("manna-menu")).toBeInTheDocument();
    expect(screen.queryByText("오늘의 SU 메뉴")).not.toBeInTheDocument();
  });
});
