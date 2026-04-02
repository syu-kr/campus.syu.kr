"use client";

import React, { useEffect, useState, memo } from "react";
import { fetchWeather, getWeatherIcon, type WeatherData } from "@/lib/weather";

interface WeatherWidgetProps {
  onClick?: () => void;
}

function WeatherWidgetComponent({ onClick }: WeatherWidgetProps) {
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
          setError("날씨 정보를 불러올 수 없습니다");
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_err) {
        setError("날씨 조회 중 오류가 발생했습니다");
      } finally {
        setLoading(false);
      }
    };

    loadWeather();

    // 1시간마다 갱신
    const interval = setInterval(loadWeather, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-100 animate-pulse">
        <div className="w-5 h-5 bg-neutral-300 rounded" />
        <span className="text-sm text-neutral-400">--°C</span>
      </div>
    );
  }

  if (error || !weather) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer active:scale-95"
    >
      {/* 날씨 아이콘 */}
      <div className="w-6 h-6 flex-shrink-0">
        <div dangerouslySetInnerHTML={{ __html: getWeatherIcon(weather) }} />
      </div>
      {/* 온도와 상태 */}
      <div className="flex items-center gap-1 text-sm">
        <span className="font-semibold text-neutral-800">
          {weather.temperature}°C
        </span>
        <span className="hidden sm:inline text-xs text-neutral-600">
          {weather.skyCondition === 0
            ? "맑음"
            : weather.skyCondition === 1
              ? "구름많음"
              : weather.skyCondition === 3
                ? "흐림"
                : ""}
        </span>
      </div>
    </button>
  );
}

export const WeatherWidget = memo(WeatherWidgetComponent);

export default WeatherWidget;
