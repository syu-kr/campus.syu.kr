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

/**
 * 날씨 상태 텍스트 반환
 */
export function getWeatherDescription(weather: WeatherData): string {
  const descriptions = [];

  // 강수 형태 (PTY 코드 기준)
  if (weather.precipitation === 1) {
    descriptions.push("비");
  } else if (weather.precipitation === 2) {
    descriptions.push("비/눈");
  } else if (weather.precipitation === 3) {
    descriptions.push("눈");
  } else if (weather.precipitation === 5) {
    descriptions.push("이슬비");
  } else if (weather.precipitation === 6) {
    descriptions.push("빗방울눈날림");
  } else if (weather.precipitation === 7) {
    descriptions.push("눈날림");
  } else if (weather.skyCondition === 1) {
    descriptions.push("맑음");
  } else if (weather.skyCondition === 3) {
    descriptions.push("구름많음");
  } else if (weather.skyCondition === 4) {
    descriptions.push("흐림");
  }

  descriptions.push(`${weather.temperature}°C`);

  return descriptions.join(" • ");
}

/**
 * 날씨에 맞는 SVG 아이콘 반환
 */
export function getWeatherIcon(weather: WeatherData): string {
  // 강수 형태 우선 확인 (PTY 코드 기준)
  if (weather.precipitation === 1 || weather.precipitation === 5) {
    // 1: 비, 5: 빗방울(이슬비)
    return getRainIcon();
  } else if (weather.precipitation === 2 || weather.precipitation === 6) {
    // 2: 비/눈, 6: 빗방울눈날림
    return getSleetIcon();
  } else if (weather.precipitation === 3 || weather.precipitation === 7) {
    // 3: 눈, 7: 눈날림
    return getSnowIcon();
  }

  // 하늘 상태 (SKY 코드 기준)
  if (weather.skyCondition === 1) {
    return getSunIcon();
  } else if (weather.skyCondition === 3) {
    return getPartlyCloudyIcon();
  } else if (weather.skyCondition === 4) {
    return getCloudyIcon();
  }

  return getSunIcon();
}

// SVG 아이콘 생성 함수들
function getSunIcon(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- 해 -->
      <circle cx="12" cy="12" r="5" fill="#FDB813"/>
      <!-- 광선 -->
      <line x1="12" y1="1" x2="12" y2="3" stroke="#FDB813" stroke-width="2" stroke-linecap="round"/>
      <line x1="12" y1="21" x2="12" y2="23" stroke="#FDB813" stroke-width="2" stroke-linecap="round"/>
      <line x1="1" y1="12" x2="3" y2="12" stroke="#FDB813" stroke-width="2" stroke-linecap="round"/>
      <line x1="21" y1="12" x2="23" y2="12" stroke="#FDB813" stroke-width="2" stroke-linecap="round"/>
      <line x1="3.5" y1="3.5" x2="4.9" y2="4.9" stroke="#FDB813" stroke-width="2" stroke-linecap="round"/>
      <line x1="19.1" y1="19.1" x2="20.5" y2="20.5" stroke="#FDB813" stroke-width="2" stroke-linecap="round"/>
      <line x1="20.5" y1="3.5" x2="19.1" y2="4.9" stroke="#FDB813" stroke-width="2" stroke-linecap="round"/>
      <line x1="4.9" y1="19.1" x2="3.5" y2="20.5" stroke="#FDB813" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

function getPartlyCloudyIcon(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- 해 -->
      <circle cx="6" cy="6" r="2.5" fill="#FDB813"/>
      <!-- 광선 -->
      <line x1="6" y1="1.5" x2="6" y2="2.5" stroke="#FDB813" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="6" y1="9.5" x2="6" y2="10.5" stroke="#FDB813" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="1.5" y1="6" x2="2.5" y2="6" stroke="#FDB813" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="9.5" y1="6" x2="10.5" y2="6" stroke="#FDB813" stroke-width="1.5" stroke-linecap="round"/>
      <!-- 구름 -->
      <path d="M5 12C5 11.17 5.51 10.47 6.24 10.16C6.92 8.21 8.68 6.8 10.8 6.8C13.42 6.8 15.57 8.62 15.87 11H16.8C18.24 11 19.4 12.16 19.4 13.6C19.4 15.04 18.24 16.2 16.8 16.2H6C4.9 16.2 4 15.3 4 14.2C4 13.12 4.84 12.23 5.91 12.06" fill="#E0E0E0" stroke="#B0BEC5" stroke-width="0.5"/>
    </svg>
  `;
}

function getCloudyIcon(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- 큰 구름 -->
      <path d="M3 14C3 12.35 4.35 11 6 11C6.2 8.9 7.9 7.3 10 7.3C11.95 7.3 13.6 8.7 13.86 10.5C15.4 10.6 16.6 11.9 16.6 13.5C16.6 15.14 15.24 16.5 13.6 16.5H4C3.45 16.5 3 16.05 3 15.5V14Z" fill="#B0BEC5" stroke="#90A4AE" stroke-width="0.5"/>
      <!-- 두 번째 구름 -->
      <path d="M8 18.2C8 17.1 8.9 16.2 10 16.2C10.15 14.7 11.3 13.5 12.8 13.5C14 13.5 15 14.3 15.3 15.4C16.3 15.5 17.1 16.3 17.1 17.4C17.1 18.6 16.14 19.6 15 19.6H9C8.45 19.6 8 19.15 8 18.6V18.2Z" fill="#78909C" stroke="#607D8B" stroke-width="0.5"/>
    </svg>
  `;
}

function getRainIcon(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- 구름 -->
      <path d="M3 14C3 12.35 4.35 11 6 11C6.2 8.9 7.9 7.3 10 7.3C11.95 7.3 13.6 8.7 13.86 10.5C15.4 10.6 16.6 11.9 16.6 13.5C16.6 15.14 15.24 16.5 13.6 16.5H4C3.45 16.5 3 16.05 3 15.5V14Z" fill="#90CAF9" stroke="#64B5F6" stroke-width="0.5"/>
      <!-- 빗줄기 -->
      <line x1="5" y1="17" x2="4" y2="21" stroke="#1976D2" stroke-width="2" stroke-linecap="round"/>
      <line x1="9" y1="17" x2="8" y2="21" stroke="#1976D2" stroke-width="2" stroke-linecap="round"/>
      <line x1="13" y1="17" x2="12" y2="21" stroke="#1976D2" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

function getSleetIcon(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- 구름 -->
      <path d="M3 14C3 12.35 4.35 11 6 11C6.2 8.9 7.9 7.3 10 7.3C11.95 7.3 13.6 8.7 13.86 10.5C15.4 10.6 16.6 11.9 16.6 13.5C16.6 15.14 15.24 16.5 13.6 16.5H4C3.45 16.5 3 16.05 3 15.5V14Z" fill="#B0BEC5" stroke="#90A4AE" stroke-width="0.5"/>
      <!-- 빗줄기 (파란색) -->
      <line x1="5" y1="17" x2="4" y2="21" stroke="#1976D2" stroke-width="2" stroke-linecap="round"/>
      <line x1="13" y1="17" x2="12" y2="21" stroke="#1976D2" stroke-width="2" stroke-linecap="round"/>
      <!-- 눈송이 (흰색) -->
      <text x="9" y="22" font-size="10" fill="#FFFFFF">❄</text>
    </svg>
  `;
}

function getSnowIcon(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- 구름 -->
      <path d="M3 14C3 12.35 4.35 11 6 11C6.2 8.9 7.9 7.3 10 7.3C11.95 7.3 13.6 8.7 13.86 10.5C15.4 10.6 16.6 11.9 16.6 13.5C16.6 15.14 15.24 16.5 13.6 16.5H4C3.45 16.5 3 16.05 3 15.5V14Z" fill="#E0E0E0" stroke="#B0BEC5" stroke-width="0.5"/>
      <!-- 눈송이 -->
      <text x="4" y="22" font-size="11" fill="#FFFFFF">❄</text>
      <text x="9" y="22" font-size="11" fill="#FFFFFF">❄</text>
      <text x="12" y="22" font-size="11" fill="#FFFFFF">❄</text>
    </svg>
  `;
}
