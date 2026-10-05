import { fetchJson } from "./fetch-json";
import type { LiveDataMeta } from "@/types/live-data";

export interface WeatherData extends LiveDataMeta {
  temperature: number; // 기온
  skyCondition: number | null; // 하늘상태 (1:맑음, 3:구름많음, 4:흐림)
  precipitation: number | null; // 강수형태 (0:없음, 1:비, 2:비/눈, 3:눈, 5:빗방울/이슬비, 6:빗방울눈날림, 7:눈날림)
  windSpeed: number | null; // 풍속
  time: string;
  latitude: number;
  longitude: number;
  gridX: number;
  gridY: number;
}
export const WEATHER_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * API 라우트를 통해 날씨 정보 조회
 */
export async function fetchWeather(): Promise<WeatherData> {
  const data = await fetchJson<unknown>("/api/weather", {
    fallback: null,
    noStore: true,
    cache: "no-store",
    throwOnError: true,
  });
  if (!isWeatherData(data)) throw new Error("Invalid weather response");
  return data;
}

function isWeatherData(data: unknown): data is WeatherData {
  if (!data || typeof data !== "object" || "error" in data) {
    return false;
  }

  const weather = data as Partial<WeatherData>;
  return (
    typeof weather.temperature === "number" &&
    (typeof weather.skyCondition === "number" ||
      weather.skyCondition === null) &&
    (typeof weather.precipitation === "number" ||
      weather.precipitation === null) &&
    (typeof weather.windSpeed === "number" || weather.windSpeed === null) &&
    typeof weather.time === "string" &&
    typeof weather.latitude === "number" &&
    typeof weather.longitude === "number" &&
    typeof weather.gridX === "number" &&
    typeof weather.gridY === "number" &&
    typeof weather.source === "string" &&
    typeof weather.timestamp === "string" &&
    typeof weather.stale === "boolean" &&
    (weather.sourceStatus === "fresh" ||
      weather.sourceStatus === "stale" ||
      weather.sourceStatus === "error")
  );
}
