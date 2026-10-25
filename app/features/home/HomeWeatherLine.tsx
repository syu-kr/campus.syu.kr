"use client";

import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDictionary } from "@/app/components/LocaleProvider";
import { getWeatherDescription } from "@/app/components/WeatherWidget";
import { fetchWeather, WEATHER_REFRESH_INTERVAL_MS } from "@/lib/weather";

const subscribeHydration = () => () => {};
const hydratedSnapshot = () => true;
const serverHydratedSnapshot = () => false;

export function HomeWeatherLine() {
  const hydrated = useSyncExternalStore(subscribeHydration, hydratedSnapshot, serverHydratedSnapshot);
  const dictionary = useDictionary(), text = dictionary.home.overview.weather;
  const query = useQuery({
    queryKey: ["weather"],
    queryFn: fetchWeather,
    staleTime: WEATHER_REFRESH_INTERVAL_MS,
    retry: false,
  });
  const weather = query.data;
  const description = weather ? getWeatherDescription(weather, dictionary.weather) : "";
  let state: "fresh" | "loading" | "updating" | "error" | "stale";
  let template: string;

  if (!hydrated || query.isPending) {
    state = "loading";
    template = text.loading;
  } else if (query.isFetching) {
    state = weather ? "updating" : "loading";
    template = weather ? text.updating : text.loading;
  } else if (query.isError || !weather || weather.sourceStatus === "error") {
    state = "error";
    template = weather ? text.failedWithPrevious : text.unavailable;
  } else if (weather.stale || weather.sourceStatus === "stale") {
    state = "stale";
    template = text.stale;
  } else {
    state = "fresh";
    template = description === dictionary.weather.unknown ? text.currentUnknownSky : text.current;
  }

  const message = template
    .replace("{temperature}", weather ? String(weather.temperature) : "")
    .replace("{description}", description);

  return <span className="m3-home-weather" data-weather-state={state} role="status" aria-live="polite">{message}</span>;
}
