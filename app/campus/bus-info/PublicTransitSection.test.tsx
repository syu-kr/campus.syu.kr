import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "@/lib/fetch-json";
import { getDictionary } from "@/lib/i18n";
import { LocaleProvider } from "@/app/components/LocaleProvider";
import PublicTransitSection from "./PublicTransitSection";

vi.mock("@/lib/fetch-json", () => ({ fetchJson: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/campus/bus-info",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

function transitPayload(minutes: number | null) {
  return {
    success: true,
    source: "public-transit-arrivals",
    sourceStatus: "fresh",
    stale: false,
    timestamp: "2026-10-04T01:00:00Z",
    data: [{
      stop: { id: "jungmun-up", direction: "up" },
      lastUpdated: "2026-10-04T01:00:00Z",
      arrivals: minutes === null ? [] : [{
        routeId: "route-200",
        routeName: "200",
        predictTime1: minutes,
        arrivalMsg1: `${minutes}분`,
        arrivalMsg2: "",
        isLow1: false,
        isLow2: false,
      }],
    }],
  };
}

let client: QueryClient;

beforeEach(() => {
  window.history.replaceState(null, "", "/campus/bus-info?tab=public-transit&lang=en");
  vi.useFakeTimers();
  vi.mocked(fetchJson).mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  client.clear();
  vi.useRealTimers();
});

async function openBusDetail() {
  render(
    <QueryClientProvider client={client}>
      <PublicTransitSection />
    </QueryClientProvider>,
  );
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  fireEvent.click(screen.getByRole("button", { name: /^200 / }));
}

describe("public transit details", () => {
  it("announces the selected stop and updates its state independently of bus details", async () => {
    vi.mocked(fetchJson).mockResolvedValue(transitPayload(10));
    const { rerender } = render(<QueryClientProvider client={client}><PublicTransitSection /></QueryClientProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    const selected = screen.getByRole("button", { pressed: true });
    const next = screen.getAllByRole("button", { pressed: false })[0];
    fireEvent.click(next);
    rerender(<QueryClientProvider client={client}><PublicTransitSection /></QueryClientProvider>);
    expect(window.location.search).toContain("stop=jungmun-down");
    expect(window.location.search).toContain("tab=public-transit");
    expect(selected).toHaveAttribute("aria-pressed", "false");
    expect(next).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("updates the open detail after polling without moving focus", async () => {
    vi.mocked(fetchJson)
      .mockResolvedValueOnce(transitPayload(10))
      .mockResolvedValue(transitPayload(7));
    await openBusDetail();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("10분")).toBeInTheDocument();
    const closeButton = within(dialog).getByRole("button", { name: "닫기" });
    closeButton.focus();

    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });

    expect(fetchJson).toHaveBeenCalledTimes(2);
    expect(within(dialog).getByText("7분")).toBeInTheDocument();
    expect(within(dialog).queryByText("10분")).not.toBeInTheDocument();
    expect(closeButton).toHaveFocus();
  });

  it("closes a removed route and does not reopen it when it returns", async () => {
    vi.mocked(fetchJson)
      .mockResolvedValueOnce(transitPayload(10))
      .mockResolvedValueOnce(transitPayload(null))
      .mockResolvedValue(transitPayload(5));
    await openBusDetail();
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(screen.getByRole("button", { name: /^200 / })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

it.each(["ko", "en"] as const)("shows a user-facing transit failure and retains retry in %s", async (locale) => {
  vi.mocked(fetchJson).mockRejectedValue(new Error("offline"));
  render(<LocaleProvider locale={locale}><QueryClientProvider client={client}>
    <PublicTransitSection />
  </QueryClientProvider></LocaleProvider>);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  const text = getDictionary(locale).pages.busInfo;
  expect(screen.getByRole("alert")).toHaveTextContent(text.infoUnavailableMessage);
  expect(screen.getByRole("alert")).not.toHaveTextContent(/API.?키|API key|not configured/i);
  vi.mocked(fetchJson).mockResolvedValue(transitPayload(6));
  fireEvent.click(screen.getByRole("button", { name: text.retry }));
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^200 / })).toBeInTheDocument();
});
