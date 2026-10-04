import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import ShuttleSection from "./ShuttleSection";
import { fetchBusLocationStatus } from "@/lib/api";
import buses from "@/public/data/shuttle-bus-schedule.json";
import periods from "@/public/data/shuttle-special-periods.json";

vi.mock("@/lib/api", () => ({
  fetchShuttleBuses: async () => buses,
  fetchShuttleSpecialPeriods: async () => periods,
  fetchBusLocationStatus: vi.fn(async () => ({
    data: [], timestamp: "2026-10-06T22:15:00+09:00",
    stale: false, sourceStatus: "fresh",
  })),
}));
vi.mock("@/app/features/shuttle/ShuttleMap", () => ({ ShuttleMap: () => null }));

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("shuttle page festival announcement", () => {
  it.each([
    ["2026-10-05T22:15:00+09:00", true],
    ["2026-10-06T22:15:00+09:00", true],
    ["2026-10-06T23:59:00+09:00", true],
    ["2026-10-07T00:00:00+09:00", false],
  ])("expires the advance announcement by the Korean date: %s", async (dateTime, visible) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(dateTime));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={client}>
        <ShuttleSection />
      </QueryClientProvider>,
    );
    await screen.findByText("학교 ↔ 석계역(4번 출구)");
    expect(screen.queryByText("축제 야간 특별운행") !== null).toBe(visible);
    expect(fetchBusLocationStatus).toHaveBeenCalledTimes(
      dateTime === "2026-10-06T22:15:00+09:00" ? 1 : 0,
    );
    view.unmount();
    client.clear();
  });
});
