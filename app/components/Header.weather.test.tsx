import type { ComponentProps } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWeather, WEATHER_REFRESH_INTERVAL_MS, type WeatherData } from "@/lib/weather";
import { getDictionary } from "@/lib/i18n";
import { Header } from "./Header";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next/link", () => ({
  default: ({ prefetch, ...props }: ComponentProps<"a"> & { prefetch?: boolean }) => { void prefetch; return <a {...props} />; },
  useLinkStatus: () => ({ pending: false }),
}));
vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
vi.mock("@/lib/weather", () => ({ fetchWeather: vi.fn(), WEATHER_REFRESH_INTERVAL_MS: 300_000 }));

const weather: WeatherData = {
  temperature: 20, skyCondition: 1, precipitation: 0, windSpeed: 1,
  time: "2026-10-05 09:00", latitude: 37.64, longitude: 127.11,
  gridX: 61, gridY: 128, source: "KMA", timestamp: "2026-10-05T09:00:00+09:00",
  stale: false, sourceStatus: "fresh",
};
const text = getDictionary("ko");
const fetchMock = vi.mocked(fetchWeather);
let queryClient: QueryClient;

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  fetchMock.mockReset();
});
afterEach(() => { queryClient.clear(); vi.useRealTimers(); });

describe("Header weather query", () => {
  it("shares one refreshed snapshot with both widgets and the open modal, keeping stale data usable when refresh fails", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    fetchMock.mockResolvedValueOnce(weather);
    render(<QueryClientProvider client={queryClient}><Header /></QueryClientProvider>);
    await waitFor(() => expect(screen.getAllByRole("button", { name: /날씨: 20°C/ })).toHaveLength(2));
    expect(fetchMock).toHaveBeenCalledOnce();
    fireEvent.click(screen.getAllByRole("button", { name: /날씨: 20°C/ })[0]);
    expect(within(screen.getByRole("dialog", { name: text.weather.label })).getByText("20°C")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();

    fetchMock.mockResolvedValueOnce({ ...weather, temperature: 23 });
    await act(() => vi.advanceTimersByTimeAsync(WEATHER_REFRESH_INTERVAL_MS));
    await waitFor(() => expect(screen.getAllByRole("button", { name: /날씨: 23°C/ })).toHaveLength(2));
    expect(within(screen.getByRole("dialog", { name: text.weather.label })).getByText("23°C")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockRejectedValueOnce(new Error("Upstream unavailable"));
    await act(() => vi.advanceTimersByTimeAsync(WEATHER_REFRESH_INTERVAL_MS));
    await screen.findByText(text.liveData.statuses.error);
    expect(screen.getAllByRole("button", { name: /날씨: 23°C/ })).toHaveLength(2);
    expect(screen.getAllByText(text.liveData.statuses.stale)).toHaveLength(2);
    fetchMock.mockResolvedValueOnce({ ...weather, temperature: 25 });
    fireEvent.click(within(screen.getByRole("dialog", { name: text.weather.label })).getByRole("button", { name: text.home.dashboard.retry }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: /날씨: 25°C/ })).toHaveLength(2));
    expect(screen.queryByText(text.liveData.statuses.error)).not.toBeInTheDocument();
    expect(screen.queryByText(text.liveData.statuses.stale)).not.toBeInTheDocument();
  });

  it("lets an initial failure retry without reloading the page", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Offline"));
    render(<QueryClientProvider client={queryClient}><Header /></QueryClientProvider>);
    const retries = await screen.findAllByRole("button", { name: `${text.weather.label}: ${text.home.dashboard.retry}` });
    expect(fetchMock).toHaveBeenCalledOnce();
    fetchMock.mockResolvedValueOnce(weather);
    fireEvent.click(retries[0]);
    await waitFor(() => expect(screen.getAllByRole("button", { name: /날씨: 20°C/ })).toHaveLength(2));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
