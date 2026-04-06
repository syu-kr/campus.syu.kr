// app/api/weather/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.NEXT_PUBLIC_PUBLIC_DATA_SERVICE_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API 키가 설정되지 않았습니다" },
        { status: 500 },
      );
    }

    // 성균관대학교 자연과학캠퍼스 좌표
    const latitude = 37.642841484;
    const longitude = 127.10846903;

    // 기상청 기본 격자 좌표
    const nx = 61; // 격자 X
    const ny = 128; // 격자 Y

    // 한국 시간(KST, UTC+9) 기준으로 현재 시간 계산
    const now = new Date();
    const kstMs = now.getTime() + 9 * 60 * 60 * 1000;

    // 밀리초 기준으로 직접 계산 (더 정확함)
    const hours = Math.floor((kstMs / 1000 / 60 / 60) % 24);
    const minutes = Math.floor((kstMs / 1000 / 60) % 60);
    const kstDate = new Date(kstMs);

    const year = kstDate.getUTCFullYear();
    const month = String(kstDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(kstDate.getUTCDate()).padStart(2, "0");
    const baseDate = `${year}${month}${day}`;

    // 초단기실황은 현재 시각의 정각 또는 1시간 전 데이터 사용
    // (API는 약 40분 지연, 예: 12시 50분이면 12시 데이터를 요청)
    let baseHour = hours;
    if (minutes < 10) {
      baseHour = baseHour === 0 ? 23 : baseHour - 1;
    }
    const baseTime = String(baseHour).padStart(2, "0") + "00";

    const params = new URLSearchParams({
      serviceKey: apiKey,
      pageNo: "1",
      numOfRows: "100",
      dataType: "JSON",
      base_date: baseDate,
      base_time: baseTime,
      nx: nx.toString(),
      ny: ny.toString(),
    });

    const apiResponse = await fetch(
      `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?${params}`,
      { cache: "no-store" },
    );

    if (!apiResponse.ok) {
      return NextResponse.json(
        { error: "기상청 API 오류" },
        { status: apiResponse.status },
      );
    }

    const data = await apiResponse.json();

    if (!data.response?.body?.items?.item) {
      return NextResponse.json(
        { error: "유효한 데이터 없음" },
        { status: 500 },
      );
    }

    // 카테고리별 실황 데이터 정렬
    const items = Array.isArray(data.response.body.items.item)
      ? data.response.body.items.item
      : [data.response.body.items.item];

    const categoryMap: Record<string, number> = {};
    items.forEach((item: Record<string, string>) => {
      categoryMap[item.category] = Number(item.obsrValue);
    });

    // T1H: 기온, PTY: 강수형태, WSD: 풍속
    const temperature = categoryMap["T1H"] ?? 0;
    const precipitation = categoryMap["PTY"] ?? 0;
    const windSpeed = categoryMap["WSD"] ?? 0;

    // 하늘상태는 초단기실황에서는 제공되지 않으므로 강수 형태로 추정
    // PTY: 0=없음, 1=비, 2=진눈깨비, 3=눈
    let skyCondition = 0;
    if (precipitation === 0) {
      skyCondition = 0; // 맑음
    } else if (precipitation === 1) {
      skyCondition = 3; // 흐림 (비)
    } else if (precipitation === 2 || precipitation === 3) {
      skyCondition = 3; // 흐림 (눈/진눈깨비)
    }

    const weatherData = {
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

    const response = NextResponse.json(weatherData);
    // 캐싱 제거
    response.headers.set(
      "Cache-Control",
      "no-cache, no-store, must-revalidate, max-age=0",
    );
    return response;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 },
    );
  }
}
