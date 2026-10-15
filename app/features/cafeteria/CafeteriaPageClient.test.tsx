import { act, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/app/components/LocaleProvider";
import { fetchCafeteriaSnapshot } from "@/lib/api";
import { toCafeteriaMenus, type CafeteriaSnapshot } from "@/lib/cafeteria";
import { getDictionary, type Locale } from "@/lib/i18n";
import { CafeteriaPageClient } from "./CafeteriaPageClient";

vi.mock("@/lib/api", () => ({ fetchCafeteriaSnapshot: vi.fn() }));
vi.mock("@/app/components/CrawlDataStatus", () => ({ CrawlDataStatus: () => null }));

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
      <CafeteriaPageClient initialSnapshot={data} initialNowIso={now} nonce="test-nonce" />
    </LocaleProvider></QueryClientProvider>,
  };
}

function expectMatchingAnswer(container: ParentNode) {
  const visible = container.querySelector("[data-answer-text]")!;
  const script = container.querySelector("#cafeteria-answer-schema")!;
  const schema = JSON.parse(script.textContent!);
  expect(schema.mainEntity[0].acceptedAnswer.text).toBe(visible.textContent);
  return visible.textContent!;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(new Date(initialNowIso));
});
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  vi.useRealTimers();
});

describe("cafeteria visible answer and JSON-LD", () => {
  it.each(["ko", "en"] as const)("renders the same initial server answer with the real source confirmation in %s", (locale) => {
    const { tree, client } = page(snapshot, locale);
    client.setQueryData(["cafeteria-weekly"], []);
    const container = document.createElement("div");
    container.innerHTML = renderToString(tree);
    expect(expectMatchingAnswer(container)).toContain("비빔밥");
    expect(container.querySelector(`time[datetime='${checkedAt}']`)).not.toBeNull();
    expect(container.querySelector("a[href='https://www.syu.ac.kr/school-life/facility-information/cafeteria/']")).not.toBeNull();
    expect(container.querySelector("#cafeteria-answer-schema")).toHaveAttribute("nonce", "test-nonce");
    expect(client.getQueryData(["cafeteria-weekly"])).toEqual([]);
  });

  it("updates menus, confirmation, visible answer and schema together after a refetch", async () => {
    const { tree, client } = page();
    const { container } = render(tree);
    const nextCheckedAt = "2026-10-15T03:01:00Z";
    vi.setSystemTime(new Date(nextCheckedAt));
    vi.mocked(fetchCafeteriaSnapshot).mockResolvedValueOnce({
      ...snapshot, checkedAt: nextCheckedAt,
      menus: toCafeteriaMenus([{ date: "2026-10-15", day: "목", meals: { lunch: ["칼국수"] } }]),
    });
    await act(async () => { await client.invalidateQueries({ queryKey: ["cafeteria-weekly-snapshot"] }); });
    await waitFor(() => expect(expectMatchingAnswer(container)).toContain("칼국수"));
    expect(container.querySelector(`time[datetime='${nextCheckedAt}']`)).not.toBeNull();
    expect(expectMatchingAnswer(container)).not.toContain("비빔밥");
  });

  it("keeps retained menus qualified after a failed refetch and preserves manual retry", async () => {
    const { tree, client } = page();
    const { container } = render(tree);
    vi.mocked(fetchCafeteriaSnapshot).mockRejectedValueOnce(new Error("offline"));
    await act(async () => { await client.invalidateQueries({ queryKey: ["cafeteria-weekly-snapshot"] }); });
    await waitFor(() => expect(expectMatchingAnswer(container)).toBe(getDictionary("ko").pages.cafeteria.staleMenuMessage));
    expect(screen.getByRole("button", { name: getDictionary("ko").home.dashboard.retry })).toBeVisible();
    expect(container.querySelector(`time[datetime='${checkedAt}']`)).not.toBeNull();
  });

  it("shows missing confirmation and stale data without claiming that the request checked the source", () => {
    const { tree } = page({ ...snapshot, checkedAt: null, stale: true });
    const { container } = render(tree);
    expect(expectMatchingAnswer(container)).toBe(getDictionary("ko").pages.cafeteria.staleMenuMessage);
    expect(screen.getByText(new RegExp(getDictionary("ko").answerSummary.unknownCheckedAt))).toBeVisible();
    expect(container.querySelector(`time[datetime='${checkedAt}']`)).toBeNull();
  });

  it("changes the visible answer and JSON-LD on Korea midnight using the same menus", () => {
    const now = "2026-10-15T14:59:00Z";
    vi.setSystemTime(new Date(now));
    const { tree } = page({
      ...snapshot,
      menus: [...snapshot.menus, ...toCafeteriaMenus([{ date: "2026-10-16", day: "금", meals: { lunch: ["볶음밥"] } }])],
    }, "ko", now);
    const { container } = render(tree);
    expect(expectMatchingAnswer(container)).toContain("비빔밥");
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(expectMatchingAnswer(container)).toContain("2026-10-16");
    expect(expectMatchingAnswer(container)).toContain("볶음밥");
  });
});
