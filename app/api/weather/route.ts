// app/api/weather/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEATHER_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedWeather:
  | {
      data: WeatherResponse;
      expiresAt: number;
    }
  | undefined;
let pendingWeather: Promise<WeatherResponse> | undefined;

interface WeatherResponse {
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

export async function GET() {
  try {
    const now = Date.now();
    if (cachedWeather && cachedWeather.expiresAt > now) {
      return weatherJson(cachedWeather.data);
    }

    pendingWeather ??= fetchWeatherFromKma().finally(() => {
      pendingWeather = undefined;
    });

    const weatherData = await pendingWeather;
    cachedWeather = {
      data: weatherData,
      expiresAt: Date.now() + WEATHER_CACHE_TTL_MS,
    };

    return weatherJson(weatherData);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 },
    );
  }
}

async function fetchWeatherFromKma(): Promise<WeatherResponse> {
  const apiKey = process.env.NEXT_PUBLIC_PUBLIC_DATA_SERVICE_KEY;
  if (!apiKey) {
    throw new Error("API 키가 설정되지 않았습니다");
  }

  // 삼육대학교 캠퍼스 좌표
  const latitude = 37.642841484;
  const longitude = 127.10846903;

  // 기상청 기본 격자 좌표
  const nx = 61; // 격자 X
  const ny = 128; // 격자 Y

  const now = new Date();
  const { baseDate, baseTime, hours, minutes } = getUltraSrtNcstBase(now);
  const forecastBase = getUltraSrtFcstBase(now);

  const ncstParams = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: "1",
    numOfRows: "100",
    dataType: "JSON",
    base_date: baseDate,
    base_time: baseTime,
    nx: nx.toString(),
    ny: ny.toString(),
  });

  const fcstParams = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: "1",
    numOfRows: "1000",
    dataType: "JSON",
    base_date: forecastBase.baseDate,
    base_time: forecastBase.baseTime,
    nx: nx.toString(),
    ny: ny.toString(),
  });

  const [ncstResponse, fcstResponse] = await Promise.all([
    fetch(
      `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?${ncstParams}`,
      { cache: "no-store" },
    ),
    fetch(
      `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst?${fcstParams}`,
      { cache: "no-store" },
    ),
  ]);

  if (!ncstResponse.ok) {
    throw new Error("기상청 실황 API 오류");
  }

  const ncstData = await ncstResponse.json();
  const fcstData = fcstResponse.ok ? await fcstResponse.json() : null;

  if (!ncstData.response?.body?.items?.item) {
    throw new Error("유효한 실황 데이터 없음");
  }

  const ncstItems = toItemArray(ncstData.response.body.items.item);
  const fcstItems = toItemArray(fcstData?.response?.body?.items?.item);

  const ncstCategoryMap: Record<string, number> = {};
  ncstItems.forEach((item) => {
    setCategoryValue(ncstCategoryMap, item.category, item.obsrValue);
  });

  const forecastTime = getNearestForecastTime(hours, minutes);
  const fcstCategoryMap: Record<string, number> = {};
  fcstItems
    .filter((item) => !item.fcstTime || item.fcstTime >= forecastTime)
    .sort((a, b) => (a.fcstTime ?? "").localeCompare(b.fcstTime ?? ""))
    .forEach((item) => {
      if (fcstCategoryMap[item.category] === undefined) {
        setCategoryValue(fcstCategoryMap, item.category, item.fcstValue);
      }
    });

  if (Object.keys(fcstCategoryMap).length === 0) {
    fcstItems
      .sort((a, b) => (a.fcstTime ?? "").localeCompare(b.fcstTime ?? ""))
      .forEach((item) => {
        if (fcstCategoryMap[item.category] === undefined) {
          setCategoryValue(fcstCategoryMap, item.category, item.fcstValue);
        }
      });
  }

  const temperature = ncstCategoryMap["T1H"] ?? fcstCategoryMap["T1H"] ?? 0;
  const precipitation = ncstCategoryMap["PTY"] ?? fcstCategoryMap["PTY"] ?? 0;
  const windSpeed = ncstCategoryMap["WSD"] ?? fcstCategoryMap["WSD"] ?? 0;
  const skyCondition =
    precipitation > 0
      ? getPrecipitationSky(precipitation)
      : (fcstCategoryMap["SKY"] ?? 1);

  return {
    temperature: Math.round(temperature),
    skyCondition,
    precipitation,
    windSpeed: Math.round(windSpeed * 10) / 10,
    time: `${baseTime.substring(0, 2)}:${baseTime.substring(2, 4)}`,
    latitude,
    longitude,
    gridX: nx,
    gridY: ny,
  };
}

type KmaItem = {
  category: string;
  obsrValue?: string;
  fcstValue?: string;
  fcstTime?: string;
};

function toItemArray(items: unknown): KmaItem[] {
  if (!items) return [];
  const itemArray = Array.isArray(items) ? items : [items];
  return itemArray.filter(
    (item): item is KmaItem =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Partial<KmaItem>).category === "string",
    );
}

function setCategoryValue(
  target: Record<string, number>,
  category: string,
  value: string | undefined,
) {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    target[category] = numericValue;
  }
}

function getKstParts(date: Date) {
  const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const year = kstDate.getUTCFullYear();
  const month = kstDate.getUTCMonth() + 1;
  const day = kstDate.getUTCDate();
  const hours = kstDate.getUTCHours();
  const minutes = kstDate.getUTCMinutes();

  return { year, month, day, hours, minutes };
}

function formatBaseDate(date: Date) {
  const { year, month, day } = getKstParts(date);
  return `${year}${String(month).padStart(2, "0")}${String(day).padStart(
    2,
    "0",
  )}`;
}

function getUltraSrtNcstBase(date: Date) {
  const { hours, minutes } = getKstParts(date);
  const baseDateTime = new Date(date);
  let baseHour = hours;

  // 초단기실황은 매시 40분 이후 안정적으로 조회된다.
  if (minutes < 40) {
    baseDateTime.setTime(baseDateTime.getTime() - 60 * 60 * 1000);
    baseHour = getKstParts(baseDateTime).hours;
  }

  return {
    baseDate: formatBaseDate(baseDateTime),
    baseTime: `${String(baseHour).padStart(2, "0")}00`,
    hours,
    minutes,
  };
}

function getUltraSrtFcstBase(date: Date) {
  const { hours, minutes } = getKstParts(date);
  const baseDateTime = new Date(date);
  let baseHour = hours;

  // 초단기예보는 매시 30분 발표라 여유를 두고 이전 발표분을 사용한다.
  if (minutes < 45) {
    baseDateTime.setTime(baseDateTime.getTime() - 60 * 60 * 1000);
    baseHour = getKstParts(baseDateTime).hours;
  }

  return {
    baseDate: formatBaseDate(baseDateTime),
    baseTime: `${String(baseHour).padStart(2, "0")}30`,
  };
}

function getNearestForecastTime(hours: number, minutes: number) {
  const forecastHour = minutes >= 45 ? hours + 1 : hours;
  return `${String(forecastHour % 24).padStart(2, "0")}00`;
}

function getPrecipitationSky(precipitation: number) {
  if ([1, 2, 3, 5, 6, 7].includes(precipitation)) {
    return 4;
  }

  return 1;
}

function weatherJson(data: WeatherResponse) {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
