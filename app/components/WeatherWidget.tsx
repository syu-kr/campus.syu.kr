"use client";

import { memo } from "react";
import type { WeatherData } from "@/lib/weather";
import { WeatherIcon } from "@/app/components/WeatherIcon";
import { useDictionary } from "@/app/components/LocaleProvider";
import { Button } from "./Button";

interface WeatherWidgetProps {
  weather: WeatherData | null;
  loading: boolean;
  failed: boolean;
  onClick?: () => void;
  onRetry: () => void;
}

function WeatherWidgetComponent({ weather, loading, failed, onClick, onRetry }: WeatherWidgetProps) {
  const dictionary = useDictionary();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-100 animate-pulse">
        <div className="w-5 h-5 bg-neutral-300 rounded" />
        <span className="text-sm text-neutral-400">--°C</span>
      </div>
    );
  }

  if (!weather) {
    return (
      <Button
        type="button"
        variant="secondary"
        onClick={onRetry}
        className="shrink-0 px-3 text-neutral-500"
        aria-label={`${dictionary.weather.label}: ${dictionary.home.dashboard.retry}`}
        title={failed ? dictionary.weather.loadError : dictionary.weather.unavailable}
      >
        <span className="font-semibold">{dictionary.weather.label}</span>
        <span>--</span>
      </Button>
    );
  }

  const weatherDescription = getWeatherDescription(
    weather,
    dictionary.weather,
  );

  return (
    <Button
      variant="secondary"
      type="button"
      onClick={onClick}
      className="shrink-0 px-3"
      aria-label={`${dictionary.weather.label}: ${weather.temperature}°C ${weatherDescription}`}
    >
      <div className="w-6 h-6 flex-shrink-0">
        <WeatherIcon weather={weather} />
      </div>
      <div className="flex items-center gap-1 text-sm">
        <span className="font-semibold text-neutral-800">
          {weather.temperature}°C
        </span>
        <span className="hidden sm:inline text-xs text-neutral-600">
          {weatherDescription}
        </span>
      </div>
      {weather.stale && (
        <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
          {dictionary.liveData.statuses.stale}
        </span>
      )}
    </Button>
  );
}

function getWeatherDescription(
  weather: WeatherData,
  dictionary: ReturnType<typeof useDictionary>["weather"],
) {
  if (weather.precipitation === 1) return dictionary.rain;
  if (weather.precipitation === 2) return dictionary.rainSnow;
  if (weather.precipitation === 3) return dictionary.snow;
  if (weather.precipitation === 5) return dictionary.drizzle;
  if (weather.precipitation === 6) return dictionary.rainSnowFlurry;
  if (weather.precipitation === 7) return dictionary.snowFlurry;
  if (weather.skyCondition === 1) return dictionary.clear;
  if (weather.skyCondition === 3) return dictionary.partlyCloudy;
  if (weather.skyCondition === 4) return dictionary.cloudy;
  return dictionary.unknown;
}

export const WeatherWidget = memo(WeatherWidgetComponent);
