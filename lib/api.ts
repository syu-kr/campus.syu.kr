import {
  Announcement,
  CafeteriaMenu,
  AcademicSchedule,
  ShuttleBusSchedule,
  ShuttleSpecialPeriods,
  BusLocation,
  Scholarship,
  PhoneNumber,
  BusStop,
  BusArrival,
  BusArrivalsAtStop,
  BusLocationInfo,
} from "@/types";

// 공지사항 API - 크롤링된 실제 데이터 사용
export async function fetchAnnouncements(
  category?: string,
): Promise<Announcement[]> {
  try {
    let data: Announcement[] = [];

    if (!category || category === "academic") {
      const academic = await fetch("/data/announcements-academic.json", {
        cache: "no-store",
        next: { revalidate: 0 },
      }).then((r) => r.json());
      data = [...data, ...(academic as Announcement[])];
    }

    if (!category || category === "scholarship") {
      const scholarship = await fetch("/data/announcements-scholarship.json", {
        cache: "no-store",
        next: { revalidate: 0 },
      }).then((r) => r.json());
      data = [
        ...data,
        ...(scholarship as Announcement[]).map((item: Announcement) => ({
          ...item,
          category: "scholarship" as const,
        })),
      ];
    }

    if (!category || category === "campus") {
      try {
        const campus = await fetch("/data/announcements-campus-life.json", {
          cache: "no-store",
          next: { revalidate: 0 },
        }).then((r) => r.json());
        data = [
          ...data,
          ...(campus as Announcement[]).map((item: Announcement) => ({
            ...item,
            category: "campus" as const,
          })),
        ];
      } catch {
        // handle silently
      }
    }

    return data;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    // Return empty array if fetch fails
    return [];
  }
}

// 학식 API - 크롤링된 실제 데이터 사용
export async function fetchCafeteriaMenu(
  date?: string,
): Promise<CafeteriaMenu[]> {
  try {
    const response = await fetch("/data/cafeteria-menu.json", {
      cache: "no-store",
      next: { revalidate: 0 },
    });
    const data = (await response.json()) as
      | Array<{ menus?: unknown[] }>
      | { menus?: unknown[] };

    // 데이터 구조 확인
    let cafeteriaData: { menus?: unknown[] };
    if (Array.isArray(data) && data.length > 0) {
      cafeteriaData = data[0];
    } else if (data && typeof data === "object" && "menus" in data) {
      cafeteriaData = data;
    } else {
      throw new Error("Invalid cafeteria data structure");
    }

    if (!cafeteriaData?.menus || !Array.isArray(cafeteriaData.menus)) {
      throw new Error("No cafeteria data");
    }

    // 크롤러 데이터를 CafeteriaMenu 형식으로 변환
    const menus: CafeteriaMenu[] = [];
    const menuDays = cafeteriaData.menus as Array<{
      date: string;
      day: string;
      meals?: {
        breakfast?: string[];
        lunch?: string[] | { a_corner?: string[]; b_corner?: string[] };
        dinner?: string[];
      };
    }>;

    menuDays.forEach((menu, idx) => {
      // 중식 처리 - A/B 코너가 있는 경우와 없는 경우 모두 처리
      const lunch: {
        a?: Array<{ name: string }>;
        b?: Array<{ name: string }>;
      } = {};
      if (menu.meals?.lunch) {
        if (Array.isArray(menu.meals.lunch)) {
          lunch.a = menu.meals.lunch.map((name) => ({ name }));
        } else if (typeof menu.meals.lunch === "object") {
          // A/B 코너가 분리된 경우
          const aCorner =
            (menu.meals.lunch as { a_corner?: string[] }).a_corner || [];
          const bCorner =
            (menu.meals.lunch as { b_corner?: string[] }).b_corner || [];
          lunch.a = aCorner.map((name) => ({ name }));
          lunch.b = bCorner.map((name) => ({ name }));
        }
      }

      const breakfast =
        menu.meals?.breakfast?.map((name) => ({
          name,
        })) || [];
      const dinner = menu.meals?.dinner?.map((name) => ({ name })) || [];

      menus.push({
        id: `cafeteria-${menu.date}-${idx}`,
        date: menu.date,
        dayOfWeek: menu.day || "",
        breakfast: breakfast,
        lunch: lunch,
        dinner: dinner,
        location: "SU-Lounge",
      });
    });

    if (date) {
      return menus.filter((m) => m.date === date);
    }

    return menus;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    return [];
  }
}

// 학사일정 API - 크롤링된 실제 데이터 사용
export async function fetchAcademicSchedules(
  category?: string,
): Promise<AcademicSchedule[]> {
  try {
    const schedules = await fetch("/data/schedules-major.json", {
      cache: "no-store",
      next: { revalidate: 0 },
    }).then((r) => r.json());

    const parsedSchedules = (schedules || []) as AcademicSchedule[];

    if (category) {
      return parsedSchedules.filter((s) => s.category === category);
    }
    return parsedSchedules;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    return [];
  }
}

// 셔틀버스 API - 크롤링된 실제 데이터 사용
export async function fetchShuttleBuses(): Promise<ShuttleBusSchedule[]> {
  try {
    const response = await fetch("/data/shuttle-bus-schedule.json", {
      cache: "no-store",
      next: { revalidate: 0 },
    });
    const schedules = await response.json();
    return (schedules || []) as ShuttleBusSchedule[];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    return [];
  }
}

// 셔틀버스 특수 기간 API
export async function fetchShuttleSpecialPeriods(): Promise<ShuttleSpecialPeriods> {
  try {
    const response = await fetch("/data/shuttle-special-periods.json", {
      cache: "no-store",
      next: { revalidate: 0 },
    });
    const data = await response.json();
    return (data || {
      specialPeriods: [],
      vacationPeriods: [],
    }) as ShuttleSpecialPeriods;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    return { specialPeriods: [], vacationPeriods: [] };
  }
}

// 장학금 API
export async function fetchScholarships(
  type?: "internal" | "external",
): Promise<Scholarship[]> {
  try {
    // API에서 실제 데이터 가져오기
    const response = await fetch("/data/announcements-scholarship.json", {
      cache: "no-store",
      next: { revalidate: 0 },
    });
    const notices = await response.json();

    const scholarshipData: Scholarship[] = (notices as Announcement[])
      .filter((notice) => {
        if (type === "internal") {
          return notice.title.includes("국내") || notice.title.includes("교내");
        } else if (type === "external") {
          return notice.title.includes("국외") || notice.title.includes("교외");
        }
        return true;
      })
      .map((notice) => ({
        id: notice.id,
        name: notice.title,
        type: (type || "internal") as "internal" | "external",
        description: notice.content || "",
        amount: 0,
        deadline: notice.author || notice.date, // author 필드에 실제 작성 날짜가 있음
        eligibility: "", // 공지사항에서 직접 추출 불가
        url: notice.url, // 외부 링크 추가
        isPinned: notice.isPinned || false, // 고정글 여부 추가
      }));

    return scholarshipData;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    return [];
  }
}

// 검색 API - 개선됨 (전체 데이터 통합 검색)
export async function searchAll(
  query: string,
): Promise<(Announcement | AcademicSchedule | Scholarship | PhoneNumber)[]> {
  if (!query.trim()) {
    return [];
  }

  const lowerQuery = query.toLowerCase();
  const results: (
    | Announcement
    | AcademicSchedule
    | Scholarship
    | PhoneNumber
  )[] = [];

  try {
    // 1. 학사일정 검색
    try {
      const schedules = await fetch("/data/schedules-major.json", {
        cache: "no-store",
        next: { revalidate: 0 },
      }).then((r) => r.json());
      const matchedSchedules = (schedules as AcademicSchedule[]).filter(
        (s) =>
          s.title?.toLowerCase().includes(lowerQuery) ||
          s.description?.toLowerCase().includes(lowerQuery),
      );
      results.push(...matchedSchedules);
    } catch {
      // handle silently
    }

    // 2. 크롤링된 공지사항 검색

    // 학사공지
    try {
      const academicNotices = await fetch("/data/announcements-academic.json", {
        cache: "no-store",
        next: { revalidate: 0 },
      }).then((r) => r.json());
      const matchedAcademic = (academicNotices as Announcement[]).filter(
        (a) =>
          a.title?.toLowerCase().includes(lowerQuery) ||
          a.content?.toLowerCase().includes(lowerQuery),
      );
      results.push(...matchedAcademic);
    } catch {
      // handle silently
    }

    // 장학금
    try {
      const scholarshipNotices = await fetch(
        "/data/announcements-scholarship.json",
        {
          cache: "no-store",
          next: { revalidate: 0 },
        },
      ).then((r) => r.json());
      const matchedScholarship = (scholarshipNotices as Announcement[]).filter(
        (a) =>
          a.title?.toLowerCase().includes(lowerQuery) ||
          a.content?.toLowerCase().includes(lowerQuery),
      );
      const withCategory = matchedScholarship.map((item) => ({
        ...item,
        category: "scholarship" as const,
      }));
      results.push(...withCategory);
    } catch {
      // handle silently
    }

    // 캠퍼스공지
    try {
      const campusNotices = await fetch(
        "/data/announcements-campus-life.json",
        {
          cache: "no-store",
          next: { revalidate: 0 },
        },
      ).then((r) => r.json());
      const matchedCampus = (campusNotices as Announcement[]).filter(
        (a) =>
          a.title?.toLowerCase().includes(lowerQuery) ||
          a.content?.toLowerCase().includes(lowerQuery),
      );
      const withCategory = matchedCampus.map((item) => ({
        ...item,
        category: "campus" as const,
      }));
      results.push(...withCategory);
    } catch {
      // handle silently
    }

    // 3. 전화번호 검색
    try {
      const phoneNumbers = await fetch("/data/phone-numbers.json", {
        next: { revalidate: 604800 },
      }).then((r) => r.json());
      const matchedPhones = (phoneNumbers as PhoneNumber[]).filter(
        (p) =>
          p.department?.toLowerCase().includes(lowerQuery) ||
          p.phone?.includes(query),
      );
      results.push(...matchedPhones);
    } catch {
      // handle silently
    }

    // 중복 제거 (ID 또는 phone/department 기반)
    const uniqueResults = Array.from(
      new Map<
        string,
        Announcement | AcademicSchedule | Scholarship | PhoneNumber
      >(
        results.map((item) => {
          if ("phone" in item) {
            return [item.phone, item];
          }
          return [item.id, item];
        }),
      ).values(),
    );

    return uniqueResults.slice(0, 100); // 최대 100개로 제한
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    return [];
  }
}

// 전화번호 API
export async function fetchPhoneNumbers(): Promise<PhoneNumber[]> {
  try {
    const response = await fetch("/data/phone-numbers.json", {
      cache: "no-store",
      next: { revalidate: 0 },
    });
    const phoneData = await response.json();
    return (phoneData || []) as PhoneNumber[];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    return [];
  }
}

// 버스 실시간 위치 API
export async function fetchBusLocations(): Promise<BusLocation[]> {
  try {
    const response = await fetch("/bus/busStatusList.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "",
      credentials: "omit",
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    // returnCode === "200" 또는 배열 데이터 직접 확인
    if (data && (data.returnCode === "200" || Array.isArray(data.data))) {
      const busArray = data.data || data;
      if (!Array.isArray(busArray)) return [];

      return busArray
        .filter((bus: Record<string, unknown>) => bus && bus.status !== 0)
        .map(
          (bus: Record<string, unknown>) =>
            ({
              ...bus,
              routeid: Number(bus.routeid) as 1 | 2 | 3,
              status: Number(bus.status) as 0 | 1 | 2,
            }) as BusLocation,
        );
    }

    return [];
  } catch {
    return [];
  }
}

// ==================== 대중교통 (시내버스) API ====================

// 정류장 설정 (고정)
export const PUBLIC_TRANSIT_STOPS: BusStop[] = [
  // [서울 버스 API 잠시 주석처리]
  // {
  //   id: "seoul-jungmun-up",
  //   name: "삼육대앞",
  //   region: "seoul",
  //   seoulArsId: "11154",
  //   lat: 37.2625,
  //   lon: 127.0284,
  //   direction: "up",
  // },
  // {
  //   id: "seoul-jungmun-down",
  //   name: "삼육대앞",
  //   region: "seoul",
  //   seoulArsId: "11155",
  //   lat: 37.2625,
  //   lon: 127.0284,
  //   direction: "down",
  // },
  {
    id: "gyeonggi-jungmun-up",
    name: "삼육대앞",
    region: "gyeonggi",
    gyeonggiStationIds: ["110000054"],
    lat: 37.6384167,
    lon: 127.10835,
    direction: "up",
  },
  {
    id: "gyeonggi-jungmun-down",
    name: "삼육대앞",
    region: "gyeonggi",
    gyeonggiStationIds: ["110000055"],
    lat: 37.6384167,
    lon: 127.10835,
    direction: "down",
  },
  {
    id: "gyeonggi-humun-up",
    name: "삼육대후문",
    region: "gyeonggi",
    gyeonggiStationIds: ["222001596"],
    lat: 37.26,
    lon: 127.03,
    direction: "up",
  },
  {
    id: "gyeonggi-humun-down",
    name: "삼육대후문",
    region: "gyeonggi",
    gyeonggiStationIds: ["222001597"],
    lat: 37.26,
    lon: 127.03,
    direction: "down",
  },
];

// [서울 버스 API 잠시 주석처리]
// 서울 버스 도착정보 조회
// async function fetchSeoulBusArrivals(arsId: string): Promise<BusArrival[]> {
//   try {
//     const serviceKey = process.env.NEXT_PUBLIC_PUBLIC_DATA_SERVICE_KEY;
//     if (!serviceKey) {
//       console.warn("Seoul bus service key not configured");
//       return [];
//     }
//
//     const url = `http://ws.bus.go.kr/api/rest/arrive/getArrInfoByStId?serviceKey=${encodeURIComponent(serviceKey)}&stId=${arsId}`;
//
//     const response = await fetch(url, {
//       method: "GET",
//       headers: { Accept: "application/xml" },
//       // 서버사이드 호출이므로 캐싱 가능
//     });
//
//     if (!response.ok) {
//       throw new Error(`Seoul API returned ${response.status}`);
//     }
//
//     const text = await response.text();
//
//     // XML 파싱 (간단한 정규식 방식)
//     const itemRegex = /<itemList>[\s\S]*?<\/itemList>/g;
//     const matches = text.match(itemRegex) || [];
//
//     const arrivals: BusArrival[] = [];
//
//     matches.forEach((item: string) => {
//       // 노선 ID와 이름 추출
//       const rtNmMatch = item.match(/<rtNm>([^<]+)<\/rtNm>/);
//       const busRouteIdMatch = item.match(/<busRouteId>([^<]+)<\/busRouteId>/);
//       const arrmsg1Match = item.match(/<arrmsg1>([^<]+)<\/arrmsg1>/);
//       const arrmsg2Match = item.match(/<arrmsg2>([^<]+)<\/arrmsg2>/);
//       const isLow1Match = item.match(/<isLow1>([^<]+)<\/isLow1>/);
//       const isLow2Match = item.match(/<isLow2>([^<]+)<\/isLow2>/);
//
//       if (rtNmMatch && arrmsg1Match) {
//         arrivals.push({
//           routeId: busRouteIdMatch?.[1] || "",
//           routeName: rtNmMatch[1],
//           arrivalMsg1: arrmsg1Match[1],
//           arrivalMsg2: arrmsg2Match?.[1] || "운행 종료",
//           isLow1: isLow1Match?.[1] === "Y",
//           isLow2: isLow2Match?.[1] === "Y",
//         });
//       }
//     });
//
//     return arrivals;
//   } catch (error) {
//     console.error("Failed to fetch Seoul bus arrivals:", error);
//     return [];
//   }
// }

// 경기도 버스 도착정보 조회
async function fetchGyeonggiBusArrivals(
  stationIds: string[],
): Promise<BusArrival[]> {
  try {
    const serviceKey = process.env.NEXT_PUBLIC_PUBLIC_DATA_SERVICE_KEY;
    if (!serviceKey) {
      console.warn("Gyeonggi bus service key not configured");
      return [];
    }

    // 각 stationId에 대해 병렬 조회
    const promises = stationIds.map(async (stationId: string) => {
      try {
        const url = `https://apis.data.go.kr/6410000/busarrivalservice/v2/getBusArrivalListv2?serviceKey=${encodeURIComponent(serviceKey)}&stationId=${stationId}&format=json`;

        const response = await fetch(url);

        if (!response.ok) {
          return [];
        }

        const data = (await response.json()) as {
          response?: {
            msgBody?: {
              busArrivalList?: Array<{
                routeName?: string | number;
                routeId?: string | number;
                predictTime1?: number;
                predictTime2?: number | string;
                lowPlate1?: number;
                lowPlate2?: number | string;
                locationNo1?: number;
                locationNo2?: number | string;
                stationNm1?: string;
                stationNm2?: string;
                crowded1?: number;
                crowded2?: number;
              }>;
            };
          };
        };

        const items = data.response?.msgBody?.busArrivalList || [];

        return items.map((item) => {
          // predictTime은 이미 분 단위 (API 문서: 초 단위라 했으나 실제는 분 단위)
          const time1 =
            typeof item.predictTime1 === "number"
              ? Math.ceil(item.predictTime1) + "분"
              : "정보 없음";
          const time2 =
            typeof item.predictTime2 === "number"
              ? Math.ceil(item.predictTime2) + "분"
              : "운행 종료";

          return {
            routeId: String(item.routeId) || "",
            routeName: String(item.routeName) || "",
            arrivalMsg1: time1,
            arrivalMsg2: time2,
            isLow1: item.lowPlate1 === 1,
            isLow2: item.lowPlate2 === 1,
            locationNo1: item.locationNo1,
            locationNo2:
              typeof item.locationNo2 === "number"
                ? item.locationNo2
                : undefined,
            nextStation1: item.stationNm1,
            nextStation2: item.stationNm2,
            predictTime1: item.predictTime1,
            predictTime2:
              typeof item.predictTime2 === "number"
                ? item.predictTime2
                : undefined,
            crowded1: item.crowded1,
            crowded2: item.crowded2,
          };
        }) as BusArrival[];
      } catch {
        return [];
      }
    });

    const results = await Promise.all(promises);

    // 모든 결과 병합 및 중복 제거
    const routeMap = new Map<string, BusArrival>();

    results.forEach((batch) => {
      batch.forEach((arrival) => {
        const key = arrival.routeId || arrival.routeName;
        if (!routeMap.has(key)) {
          routeMap.set(key, arrival);
        }
      });
    });

    return Array.from(routeMap.values());
  } catch (error) {
    console.error("Failed to fetch Gyeonggi bus arrivals:", error);
    return [];
  }
}

// 대중교통 도착 정보 통합 조회 (모든 정류장)
export async function fetchPublicTransitArrivals(): Promise<
  BusArrivalsAtStop[]
> {
  const results: BusArrivalsAtStop[] = [];
  const stopMap = new Map<string, BusArrivalsAtStop>();

  // 병렬로 모든 정류장의 도착정보 조회
  const promises = PUBLIC_TRANSIT_STOPS.map(async (stop) => {
    let arrivals: BusArrival[] = [];

    // [서울 버스 API 잠시 주석처리]
    // if (stop.region === "seoul" && stop.seoulArsId) {
    //   arrivals = await fetchSeoulBusArrivals(stop.seoulArsId);
    // } else
    if (
      stop.region === "gyeonggi" &&
      stop.gyeonggiStationIds &&
      stop.gyeonggiStationIds.length > 0
    ) {
      arrivals = await fetchGyeonggiBusArrivals(stop.gyeonggiStationIds);
    }

    // noLine 또는 빈 응답 제거
    arrivals = arrivals.filter((a) => a.routeName && a.routeName !== "noLine");

    // 위치/방향 기반 통합 키 생성 (같은 위치의 서울/경기도 합치기)
    const locationPrefix = stop.id.includes("jungmun")
      ? "jungmun"
      : stop.id.includes("humun")
        ? "humun"
        : "unknown";
    const mergeKey = `${locationPrefix}-${stop.direction}`;

    if (stopMap.has(mergeKey)) {
      // 이미 이 방향의 데이터가 있으면 arrivals 병합
      const existing = stopMap.get(mergeKey)!;
      existing.arrivals.push(...arrivals);
      existing.lastUpdated = new Date();
    } else {
      // 새로운 방향 데이터
      stopMap.set(mergeKey, {
        stop: {
          ...stop,
          // 이름을 위치+방향으로 통일 (서울/경기도 구분 제거)
          id: mergeKey,
        },
        arrivals,
        lastUpdated: new Date(),
      });
    }
  });

  await Promise.all(promises);

  // 맵의 값들을 배열로 변환
  Array.from(stopMap.values()).forEach((item) => {
    // 도착 시간순으로 정렬
    item.arrivals.sort((a, b) => {
      const timeA = a.predictTime1 || Infinity;
      const timeB = b.predictTime1 || Infinity;
      return timeA - timeB;
    });
    results.push(item);
  });

  return results;
}

// 서울 버스 위치 정보 조회 (노선 ID 필요)
// 향후 차량 위치 맵 표시에 사용될 예정
// [서울 버스 API 잠시 주석처리]
// export async function fetchSeoulBusLocations(
//   busRouteId: string,
// ): Promise<BusLocationInfo[]> {
//   try {
//     const serviceKey = process.env.NEXT_PUBLIC_PUBLIC_DATA_SERVICE_KEY;
//     if (!serviceKey) return [];
//
//     const url = `http://ws.bus.go.kr/api/rest/buspos/getBusPosByRtid?serviceKey=${encodeURIComponent(serviceKey)}&busRouteId=${busRouteId}`;
//
//     const response = await fetch(url);
//
//     if (!response.ok) return [];
//
//     const text = await response.text();
//
//     // XML 파싱
//     const itemRegex = /<itemList>[\s\S]*?<\/itemList>/g;
//     const matches = text.match(itemRegex) || [];
//
//     return matches
//       .map((item: string) => {
//         const busidMatch = item.match(/<busid>([^<]+)<\/busid>/);
//         const busnmMatch = item.match(/<busnm>([^<]+)<\/busnm>/);
//         const routeidMatch = item.match(/<routeid>([^<]+)<\/routeid>/);
//         const gpsXMatch = item.match(/<gpsX>([^<]+)<\/gpsX>/);
//         const gpsYMatch = item.match(/<gpsY>([^<]+)<\/gpsY>/);
//         const nextStnMatch = item.match(/<nextStn>([^<]+)<\/nextStn>/);
//
//         if (busidMatch && gpsXMatch && gpsYMatch) {
//           return {
//             vehId: busidMatch[1],
//             routeId: routeidMatch?.[1] || busRouteId,
//             routeName: busnmMatch?.[1] || "",
//             lon: parseFloat(gpsXMatch[1]),
//             lat: parseFloat(gpsYMatch[1]),
//             nextStationName: nextStnMatch?.[1] || "정보 없음",
//           } as BusLocationInfo;
//         }
//
//         return null;
//       })
//       .filter(
//         (item: BusLocationInfo | null) => item !== null,
//       ) as BusLocationInfo[];
//   } catch (error) {
//     console.error("Failed to fetch Seoul bus locations:", error);
//     return [];
//   }
// }

// 경기도 버스 위치 정보 조회
// 향후 차량 위치 맵 표시에 사용될 예정
export async function fetchGyeonggiBusLocations(
  routeId: string,
): Promise<BusLocationInfo[]> {
  try {
    const serviceKey = process.env.NEXT_PUBLIC_PUBLIC_DATA_SERVICE_KEY;
    if (!serviceKey) return [];

    const url = `https://apis.data.go.kr/6410000/buslocationservice/v2/getBusLocationListv2?serviceKey=${encodeURIComponent(serviceKey)}&routeId=${routeId}&format=json`;

    const response = await fetch(url);

    if (!response.ok) return [];

    const data = (await response.json()) as {
      response?: {
        body?: {
          items?: Array<{
            vehId?: string;
            routeId?: string;
            busNo?: string;
            lon?: number;
            lat?: number;
            nextStationName?: string;
          }>;
        };
      };
    };

    const items = data.response?.body?.items || [];

    return items.map((item) => ({
      vehId: item.vehId || "",
      routeId: item.routeId || routeId,
      routeName: item.busNo || "",
      lon: item.lon || 0,
      lat: item.lat || 0,
      nextStationName: item.nextStationName || "정보 없음",
    })) as BusLocationInfo[];
  } catch (error) {
    console.error("Failed to fetch Gyeonggi bus locations:", error);
    return [];
  }
}
