// lib/weather.ts - 날씨 정보 조회

export interface WeatherData {
  temperature: number; // 기온
  skyCondition: number; // 하늘상태 (0:맑음, 1:구름많음, 3:흐림)
  precipitation: number; // 강수형태 (0:없음, 1:비, 2:비/눈, 3:눈)
  windSpeed: number; // 풍속
  time: string;
  latitude: number;
  longitude: number;
  gridX: number;
  gridY: number;
}

// 1분 캐싱을 위한 메모리 저장소
let cachedWeather: WeatherData | null = null;
let cachedTime: number = 0;
let cachedHour: number = -1; // 마지막 캐시된 시간의 hour
const CACHE_DURATION = 60 * 1000; // 1분

/**
 * 한국 시간(KST) 기준 현재 hour 반환
 */
function getCurrentKSTHour(): number {
  const now = new Date();
  const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kstTime.getUTCHours();
}

/**
 * API 라우트를 통해 날씨 정보 조회
 */
export async function fetchWeather(): Promise<WeatherData | null> {
  try {
    const now = Date.now();
    const currentHour = getCurrentKSTHour();

    // 1분 캐시 확인 + hour 변경 확인
    if (
      cachedWeather &&
      now - cachedTime < CACHE_DURATION &&
      currentHour === cachedHour
    ) {
      return cachedWeather;
    }

    const response = await fetch("/api/weather", {
      cache: "force-cache", // 서버 캐시 활용 (max-age=60)
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data || data.error) {
      return null;
    }

    // 캐시 업데이트
    cachedWeather = data as WeatherData;
    cachedTime = now;
    cachedHour = currentHour;

    return data as WeatherData;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    return null;
  }
}

/**
 * 날씨 상태 텍스트 반환
 */
export function getWeatherDescription(weather: WeatherData): string {
  const descriptions = [];

  // 강수 형태
  if (weather.precipitation === 1) {
    descriptions.push("비");
  } else if (weather.precipitation === 2) {
    descriptions.push("비/눈");
  } else if (weather.precipitation === 3) {
    descriptions.push("눈");
  } else if (weather.skyCondition === 0) {
    descriptions.push("맑음");
  } else if (weather.skyCondition === 1) {
    descriptions.push("구름많음");
  } else if (weather.skyCondition === 3) {
    descriptions.push("흐림");
  }

  descriptions.push(`${weather.temperature}°C`);

  return descriptions.join(" • ");
}

/**
 * 날씨에 맞는 SVG 아이콘 반환
 */
export function getWeatherIcon(weather: WeatherData): string {
  // 강수 형태 우선 확인
  if (weather.precipitation === 1) {
    return getRainIcon();
  } else if (weather.precipitation === 2) {
    return getSleetIcon();
  } else if (weather.precipitation === 3) {
    return getSnowIcon();
  }

  // 하늘 상태
  if (weather.skyCondition === 0) {
    return getSunIcon();
  } else if (weather.skyCondition === 1) {
    return getPartlyCloudyIcon();
  } else if (weather.skyCondition === 3) {
    return getCloudyIcon();
  }

  return getSunIcon();
}

// SVG 아이콘 생성 함수들
function getSunIcon(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="5" fill="#FFD700"/>
      <line x1="12" y1="1" x2="12" y2="3" stroke="#FFD700" stroke-width="2"/>
      <line x1="12" y1="21" x2="12" y2="23" stroke="#FFD700" stroke-width="2"/>
      <line x1="1" y1="12" x2="3" y2="12" stroke="#FFD700" stroke-width="2"/>
      <line x1="21" y1="12" x2="23" y2="12" stroke="#FFD700" stroke-width="2"/>
      <line x1="3" y1="3" x2="4.5" y2="4.5" stroke="#FFD700" stroke-width="2"/>
      <line x1="19.5" y1="19.5" x2="21" y2="21" stroke="#FFD700" stroke-width="2"/>
      <line x1="21" y1="3" x2="19.5" y2="4.5" stroke="#FFD700" stroke-width="2"/>
      <line x1="4.5" y1="19.5" x2="3" y2="21" stroke="#FFD700" stroke-width="2"/>
    </svg>
  `;
}

function getCloudyIcon(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 18H18C19.65 18 21 16.65 21 15C21 13.65 20.36 12.46 19.35 11.8C19.12 8.57 16.57 6 13.5 6C11.22 6 9.24 7.27 8.29 9.04C5.95 9.22 4 11.34 4 14C4 16.76 6.24 19 9 19" fill="#B0BEC5"/>
    </svg>
  `;
}

function getPartlyCloudyIcon(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="15" cy="9" r="4" fill="#FFD700"/>
      <path d="M6 18H15C16.65 18 18 16.65 18 15C18 13.65 17.36 12.46 16.35 11.8C16.12 10.57 15.22 9.5 14 9.2" fill="#B0BEC5"/>
    </svg>
  `;
}

function getRainIcon(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 18H16C17.65 18 19 16.65 19 15C19 13.65 18.36 12.46 17.35 11.8C17.12 9.57 15.57 7.8 13.5 7.8C11.7 7.8 10.13 8.75 9.35 10.24C7.35 10.4 5.8 12.1 5.8 14C5.8 16.13 7.57 17.8 9.8 18" fill="#90CAF9"/>
      <line x1="8" y1="19" x2="7" y2="22" stroke="#4FC3F7" stroke-width="2"/>
      <line x1="12" y1="19" x2="11" y2="22" stroke="#4FC3F7" stroke-width="2"/>
      <line x1="16" y1="19" x2="15" y2="22" stroke="#4FC3F7" stroke-width="2"/>
    </svg>
  `;
}

function getSleetIcon(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 18H16C17.65 18 19 16.65 19 15C19 13.65 18.36 12.46 17.35 11.8C17.12 9.57 15.57 7.8 13.5 7.8C11.7 7.8 10.13 8.75 9.35 10.24C7.35 10.4 5.8 12.1 5.8 14C5.8 16.13 7.57 17.8 9.8 18" fill="#B0BEC5"/>
      <line x1="8" y1="19" x2="7" y2="22" stroke="#4FC3F7" stroke-width="2"/>
      <line x1="12" y1="19" x2="11" y2="22" stroke="#FFD700" stroke-width="2"/>
      <line x1="16" y1="19" x2="15" y2="22" stroke="#4FC3F7" stroke-width="2"/>
    </svg>
  `;
}

function getSnowIcon(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 18H16C17.65 18 19 16.65 19 15C19 13.65 18.36 12.46 17.35 11.8C17.12 9.57 15.57 7.8 13.5 7.8C11.7 7.8 10.13 8.75 9.35 10.24C7.35 10.4 5.8 12.1 5.8 14C5.8 16.13 7.57 17.8 9.8 18" fill="#E0E0E0"/>
      <g opacity="0.8">
        <path d="M8 20L8.5 22L7.5 22Z" fill="#FFFFFF"/>
        <path d="M12 20L12.5 22L11.5 22Z" fill="#FFFFFF"/>
        <path d="M16 20L16.5 22L15.5 22Z" fill="#FFFFFF"/>
      </g>
    </svg>
  `;
}
