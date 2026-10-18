import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/app/components/LocaleProvider";
import { getTodayInfo } from "@/lib/home";
import { getDictionary, type Locale } from "@/lib/i18n";
import { TodayStudentRestaurantSection } from "./HomeDashboardSections";

const publicUrl = "https://example.github.io/cafeteria/student-restaurant-1.json";
const dictionary = getDictionary("ko");
const text = dictionary.pages.cafeteria.studentRestaurant;
const menu = {
  updatedAt: "2026-10-16T00:00:00Z", weekStart: "2026-10-12",
  days: [
    { date: "2026-10-15", breakfast: ["어제 조식"], lunch: [], dinner: null },
    { date: "2026-10-16", breakfast: ["오늘 밥", "오늘 국", "오늘 반찬"], lunch: [], dinner: null },
    { date: "2026-10-19", breakfast: ["다음 주 조식"], lunch: [], dinner: null },
  ],
};
const clients: QueryClient[] = [];

function renderSection(today = "2026-10-16", locale: Locale = "ko") {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <LocaleProvider locale={locale}>
        <TodayStudentRestaurantSection todayInfo={getTodayInfo(new Date(`${today}T12:00:00+09:00`))} />
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CAFETERIA_JSON_URL", publicUrl);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => menu }));
});

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("home Manna House menu", () => {
  it("previews only today's meals and opens Manna House directly", async () => {
    renderSection();
    expect(await screen.findByText("오늘 밥, 오늘 국 외")).toBeInTheDocument();
    const section = screen.getByRole("region", { name: text.title });
    expect(within(section).getByRole("heading", { level: 3, name: text.title })).toBeInTheDocument();
    expect(within(section).getByText(dictionary.home.dashboard.closedMeal)).toBeInTheDocument();
    expect(within(section).getByText(text.unknownMeal)).toBeInTheDocument();
    expect(within(section).getByText("2026-10-16")).toHaveAttribute("dateTime", "2026-10-16");
    expect(screen.queryByText(/어제 조식|다음 주 조식|오늘 반찬/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("link").every((link) => link.getAttribute("href") === "/campus/cafeteria?restaurant=manna")).toBe(true);
    expect(fetch).toHaveBeenCalledWith(publicUrl, expect.objectContaining({ credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" }));
  });

  it("never substitutes stored meals when today's menu is missing", async () => {
    renderSection("2026-10-26");
    expect(await screen.findByText(dictionary.pages.cafeteria.missingToday)).toBeInTheDocument();
    expect(screen.queryByText(/어제 조식|오늘 밥|다음 주 조식/)).not.toBeInTheDocument();
  });

  it("shows loading, then replaces it with the menu", async () => {
    let finish!: (value: unknown) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => { finish = resolve; })));
    renderSection();
    expect(screen.getByRole("status", { name: text.loading })).toHaveAttribute("aria-busy", "true");
    finish({ ok: true, json: async () => menu });
    expect(await screen.findByText("오늘 밥, 오늘 국 외")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("provides a retry when the public JSON cannot be loaded", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    renderSection();
    const retry = await screen.findByRole("button", { name: dictionary.home.dashboard.retry });
    expect(screen.getByText(dictionary.home.dashboard.loadFailedMessage)).toBeInTheDocument();
    fetchMock.mockResolvedValue({ ok: true, json: async () => menu });
    fireEvent.click(retry);
    expect(await screen.findByText("오늘 밥, 오늘 국 외")).toBeInTheDocument();
  });

  it("shows preparation when the public endpoint is not configured without fetching", () => {
    vi.stubEnv("NEXT_PUBLIC_CAFETERIA_JSON_URL", "");
    renderSection();
    expect(screen.getByText(text.notConfigured)).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("localizes the labels and Manna House destination", async () => {
    renderSection("2026-10-16", "en");
    expect(await screen.findByText("오늘 밥, 오늘 국 more")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: getDictionary("en").pages.cafeteria.studentRestaurant.title })).toBeInTheDocument();
    expect(screen.getByText("Menu unavailable")).toBeInTheDocument();
    expect(screen.getAllByRole("link").every((link) => link.getAttribute("href") === "/en/campus/cafeteria?restaurant=manna")).toBe(true);
  });
});
