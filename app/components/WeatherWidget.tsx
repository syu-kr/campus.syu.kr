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

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer active:scale-95"
    >
      <div className="w-6 h-6 flex-shrink-0">
        <WeatherIcon weather={weather} />
      </div>
      <div className="flex items-center gap-1 text-sm">
        <span className="font-semibold text-neutral-800">
          {weather.temperature}°C
        </span>
        <span className="hidden sm:inline text-xs text-neutral-600">
          {weather.precipitation === 1
            ? dictionary.weather.rain
            : weather.precipitation === 2
              ? dictionary.weather.rainSnow
              : weather.precipitation === 3
                ? dictionary.weather.snow
                : weather.precipitation === 5
                  ? dictionary.weather.drizzle
                  : weather.precipitation === 6
                    ? dictionary.weather.rainSnowFlurry
                    : weather.precipitation === 7
                      ? dictionary.weather.snowFlurry
                      : weather.skyCondition === 1
                        ? dictionary.weather.clear
                        : weather.skyCondition === 3
                          ? dictionary.weather.partlyCloudy
                          : weather.skyCondition === 4
                            ? dictionary.weather.cloudy
                            : ""}
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

export const WeatherWidget = memo(WeatherWidgetComponent);
