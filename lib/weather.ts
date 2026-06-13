import { fetchJson } from "./fetch-json";

export interface WeatherData {
  temperature: number; // 기온
  skyCondition: number; // 하늘상태 (1:맑음, 3:구름많음, 4:흐림)
  precipitation: number; // 강수형태 (0:없음, 1:비, 2:비/눈, 3:눈, 5:빗방울/이슬비, 6:빗방울눈날림, 7:눈날림)
  windSpeed: number; // 풍속
  time: string;
  latitude: number;
  longitude: number;
  gridX: number;
  gridY: number;
}
const WEATHER_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedWeather:
  | {
      data: WeatherData;
      expiresAt: number;
    }
  | undefined;
let pendingWeather: Promise<WeatherData | null> | undefined;

/**
 * API 라우트를 통해 날씨 정보 조회
 */
export async function fetchWeather(): Promise<WeatherData | null> {
  const now = Date.now();
  if (cachedWeather && cachedWeather.expiresAt > now) {
    return cachedWeather.data;
  }

  const cacheKey = Math.floor(now / WEATHER_CACHE_TTL_MS);

  pendingWeather ??= fetchJson<unknown>(`/api/weather?ts=${cacheKey}`, {
    fallback: null,
    noStore: true,
    cache: "no-store",
  })
    .then((data) => {
      if (!isWeatherData(data)) return null;

      cachedWeather = {
        data,
        expiresAt: Date.now() + WEATHER_CACHE_TTL_MS,
      };
      return data;
    })
    .finally(() => {
      pendingWeather = undefined;
    });

  return pendingWeather;
}

function isWeatherData(data: unknown): data is WeatherData {
  if (!data || typeof data !== "object" || "error" in data) {
    return false;
  }

  const weather = data as Partial<WeatherData>;
  return (
    typeof weather.temperature === "number" &&
    typeof weather.skyCondition === "number" &&
    typeof weather.precipitation === "number" &&
    typeof weather.windSpeed === "number" &&
    typeof weather.time === "string" &&
    typeof weather.latitude === "number" &&
    typeof weather.longitude === "number" &&
    typeof weather.gridX === "number" &&
    typeof weather.gridY === "number"
  );
}
