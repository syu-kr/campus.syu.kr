"use client";

import { useEffect, useState, memo } from "react";
import { fetchWeather, type WeatherData } from "@/lib/weather";
import { WeatherIcon } from "@/app/components/WeatherIcon";
import { useDictionary } from "@/app/components/LocaleProvider";

interface WeatherWidgetProps {
  onClick?: () => void;
}

function WeatherWidgetComponent({ onClick }: WeatherWidgetProps) {
  const dictionary = useDictionary();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadWeather = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchWeather();
        if (data) {
          setWeather(data);
        } else {
          setError(dictionary.weather.unavailable);
        }
      } catch {
        setError(dictionary.weather.loadError);
      } finally {
        setLoading(false);
      }
    };

    loadWeather();
  }, [dictionary.weather.loadError, dictionary.weather.unavailable]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-100 animate-pulse">
        <div className="w-5 h-5 bg-neutral-300 rounded" />
        <span className="text-sm text-neutral-400">--°C</span>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div
        className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500"
        role="status"
        title={error ?? dictionary.weather.unavailable}
      >
        <span className="font-semibold">{dictionary.weather.label}</span>
        <span>--</span>
      </div>
    );
  }

  const weatherDescription = getWeatherDescription(
    weather,
    dictionary.weather,
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 transition-colors hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 active:bg-neutral-100"
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
    </button>
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
