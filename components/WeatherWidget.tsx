"use client";

import { useEffect, useState } from "react";
import {
  fetchWeather,
  getWeatherDescription,
  getWeatherIcon,
} from "@/lib/weather";

interface WeatherData {
  temperature: number;
  skyCondition: number;
  precipitation: number;
  windSpeed: number;
  time: string;
  latitude: number;
  longitude: number;
  gridX: number;
  gridY: number;
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadWeather() {
      setLoading(true);
      try {
        const data = await fetchWeather();
        if (data) {
          setWeather(data);
          setError(null);
        } else {
          setError("날씨 정보를 불러올 수 없습니다");
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_err) {
        setError("날씨 조회 중 오류가 발생했습니다");
      } finally {
        setLoading(false);
      }
    }

    loadWeather();

    // 1분마다 확인 (캐시 만료나 시간 변경 감지용)
    const interval = setInterval(loadWeather, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
        <div className="w-6 h-6 bg-gray-300 rounded animate-pulse" />
        <div className="h-4 w-24 bg-gray-300 rounded animate-pulse" />
      </div>
    );
  }

  if (error || !weather) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      {/* 아이콘 */}
      <div
        className="w-6 h-6 flex-shrink-0"
        dangerouslySetInnerHTML={{ __html: getWeatherIcon(weather) }}
      />

      {/* 텍스트 정보 */}
      <div className="flex flex-col">
        <span className="text-xs font-medium text-gray-700">
          {getWeatherDescription(weather)}
        </span>
        <span className="text-xs text-gray-500">{weather.time} 기준</span>
      </div>

      {/* 풍속 정보 */}
      <div className="ml-auto flex items-center gap-1 text-xs text-gray-600">
        <span className="text-lg">💨</span>
        <span>{weather.windSpeed} m/s</span>
      </div>
    </div>
  );
}
