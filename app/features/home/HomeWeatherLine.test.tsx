import { act, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientLocaleProvider } from "@/app/components/LocaleContext";
import { getDictionary, type Locale } from "@/lib/i18n";
import { fetchWeather, WEATHER_REFRESH_INTERVAL_MS, type WeatherData } from "@/lib/weather";
import { HomeWeatherLine } from "./HomeWeatherLine";

vi.mock("@/lib/weather", () => ({ fetchWeather: vi.fn(), WEATHER_REFRESH_INTERVAL_MS: 300_000 }));
const fetchMock = vi.mocked(fetchWeather);
const weather: WeatherData = {
  temperature: 14, skyCondition: 4, precipitation: 0, windSpeed: 1,
  time: "2026-10-26 09:00", latitude: 37.64, longitude: 127.11, gridX: 61, gridY: 128,
  source: "KMA", timestamp: "2026-10-26T09:00:00+09:00", stale: false, sourceStatus: "fresh",
};
let client: QueryClient;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  fetchMock.mockReset().mockResolvedValue(weather);
  client.setQueryData(["weather"], weather);
});
afterEach(() => client.clear());

function renderLine(locale: Locale) {
  return render(<ClientLocaleProvider locale={locale} dictionary={getDictionary(locale)}>
    <QueryClientProvider client={client}><HomeWeatherLine /></QueryClientProvider>
  </ClientLocaleProvider>);
}
function message(locale: Locale, key: keyof ReturnType<typeof getDictionary>["home"]["overview"]["weather"], description?: string) {
  const dictionary = getDictionary(locale);
  return dictionary.home.overview.weather[key].replace("{temperature}", "14").replace("{description}", description ?? dictionary.weather.cloudy);
}

describe.each(["ko", "en"] as const)("campus weather sentence in %s", locale => {
  it("hydrates a cold SSR sentence against an already warm Header weather cache without a mismatch", async () => {
    const serverClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const content = (cache: QueryClient) => <ClientLocaleProvider locale={locale} dictionary={getDictionary(locale)}>
      <QueryClientProvider client={cache}><HomeWeatherLine /></QueryClientProvider>
    </ClientLocaleProvider>;
    const html = renderToString(content(serverClient));
    expect(html).toContain(getDictionary(locale).home.overview.weather.loading);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const recoverableError = vi.fn();
    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => { root = hydrateRoot(container, content(client), { onRecoverableError: recoverableError }); });
    await waitFor(() => expect(container.querySelector(".m3-home-weather")).toHaveAttribute("data-weather-state", "fresh"));
    expect(container).toHaveTextContent(message(locale, "current"));
    expect(recoverableError).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    container.remove();
    serverClient.clear();
  });
  it("uses the fresh shared weather cache and the existing weather description", () => {
    renderLine(locale);
    expect(screen.getByRole("status")).toHaveTextContent(message(locale, "current"));
    expect(screen.getByRole("status")).toHaveAttribute("data-weather-state", "fresh");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.getQueryCache().findAll()).toHaveLength(1);
  });

  it("uses the existing precipitation description before the sky description", () => {
    client.setQueryData(["weather"], { ...weather, precipitation: 1 });
    renderLine(locale);
    expect(screen.getByRole("status")).toHaveTextContent(message(locale, "current", getDictionary(locale).weather.rain));
  });

  it("shows a loading sentence without presenting a temperature as current", () => {
    client.removeQueries({ queryKey: ["weather"] });
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderLine(locale);
    expect(screen.getByRole("status")).toHaveTextContent(message(locale, "loading"));
    expect(screen.getByRole("status")).not.toHaveTextContent("14");
  });

  it("keeps the previous value explicitly labelled while refreshing", () => {
    client.setQueryData(["weather"], weather, { updatedAt: Date.now() - WEATHER_REFRESH_INTERVAL_MS - 1 });
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderLine(locale);
    expect(screen.getByRole("status")).toHaveTextContent(message(locale, "updating"));
    expect(screen.getByRole("status")).toHaveAttribute("data-weather-state", "updating");
  });

  it("reports an initial failure without a current value", async () => {
    client.removeQueries({ queryKey: ["weather"] });
    fetchMock.mockRejectedValue(new Error("Offline"));
    renderLine(locale);
    expect(await screen.findByText(message(locale, "unavailable"))).toHaveAttribute("data-weather-state", "error");
  });

  it("labels the previous observation after a failed refresh", async () => {
    client.setQueryData(["weather"], weather, { updatedAt: Date.now() - WEATHER_REFRESH_INTERVAL_MS - 1 });
    fetchMock.mockRejectedValue(new Error("Offline"));
    renderLine(locale);
    expect(await screen.findByText(message(locale, "failedWithPrevious"))).toHaveAttribute("data-weather-state", "error");
  });

  it("withholds the current-weather claim for a stale source", () => {
    client.setQueryData(["weather"], { ...weather, stale: true, sourceStatus: "stale" });
    renderLine(locale);
    expect(screen.getByRole("status")).toHaveTextContent(message(locale, "stale"));
    expect(screen.getByRole("status")).toHaveAttribute("data-weather-state", "stale");
  });

  it("does not invent unknown sky conditions", () => {
    client.setQueryData(["weather"], { ...weather, skyCondition: null, precipitation: null });
    renderLine(locale);
    expect(screen.getByRole("status")).toHaveTextContent(message(locale, "currentUnknownSky"));
  });
});
