import type { BusRouteDestination } from "@/types";

type PublicTransitStopId =
  | "jungmun-up"
  | "jungmun-down"
  | "humun-up"
  | "humun-down";

type DestinationSource = {
  name: string;
  url: string;
  verifiedAt: string;
};

type RouteDestinationRecord = {
  routeId: string;
  routeName: string;
  source: DestinationSource;
  destinations: Partial<
    Record<PublicTransitStopId, BusRouteDestination>
  >;
};

const OFFICIAL_GYEONGGI_ROUTE_SOURCE = {
  name: "경기버스정보 경유정류소 목록조회",
  url: "https://apis.data.go.kr/6410000/busrouteservice/v2/getBusRouteStationListv2",
  verifiedAt: "2026-07-20",
} as const satisfies DestinationSource;

function toward(
  labelKo: string,
  labelEn: string,
  kind: BusRouteDestination["kind"] = "terminal",
): BusRouteDestination {
  return {
    labelKo: `${labelKo} 방면`,
    labelEn: `Toward ${labelEn}`,
    kind,
  };
}

function terminus(labelKo: string, labelEn: string): BusRouteDestination {
  return {
    labelKo: `${labelKo} 종점`,
    labelEn: `${labelEn} terminus`,
    kind: "current-stop-terminal",
  };
}

const ROUTE_DESTINATIONS: ReadonlyArray<RouteDestinationRecord> = [
  {
    routeId: "100100039",
    routeName: "202",
    source: OFFICIAL_GYEONGGI_ROUTE_SOURCE,
    destinations: {
      "jungmun-up": toward("불암동", "Buram-dong"),
      "jungmun-down": toward("후암동", "Huam-dong"),
      "humun-up": toward("불암동", "Buram-dong"),
      "humun-down": toward("후암동", "Huam-dong"),
    },
  },
  {
    routeId: "100100166",
    routeName: "2212",
    source: OFFICIAL_GYEONGGI_ROUTE_SOURCE,
    destinations: {
      "jungmun-up": toward("불암동", "Buram-dong"),
      "jungmun-down": toward("서일대학교", "Seoil University"),
      "humun-up": toward("불암동", "Buram-dong"),
      "humun-down": toward("서일대학교", "Seoil University"),
    },
  },
  {
    routeId: "110000009",
    routeName: "2155",
    source: OFFICIAL_GYEONGGI_ROUTE_SOURCE,
    destinations: {
      "jungmun-up": toward("불암동", "Buram-dong"),
      "jungmun-down": toward("석계역", "Seokgye Station", "major-stop"),
    },
  },
  {
    routeId: "222000008",
    routeName: "155",
    source: OFFICIAL_GYEONGGI_ROUTE_SOURCE,
    destinations: {
      "jungmun-up": toward("청학리", "Cheonghak-ri"),
      "jungmun-down": toward("석계역", "Seokgye Station"),
      "humun-up": toward("청학리", "Cheonghak-ri"),
      "humun-down": toward("석계역", "Seokgye Station"),
    },
  },
  {
    routeId: "222000222",
    routeName: "115",
    source: OFFICIAL_GYEONGGI_ROUTE_SOURCE,
    destinations: {
      "jungmun-up": toward("사능차고지", "Saneung Bus Garage"),
      "jungmun-down": toward("석계역", "Seokgye Station"),
    },
  },
  {
    routeId: "241339004",
    routeName: "2-2",
    source: OFFICIAL_GYEONGGI_ROUTE_SOURCE,
    destinations: {
      "jungmun-up": toward(
        "구리역·롯데백화점",
        "Guri Station / Lotte Department Store",
      ),
      "jungmun-down": terminus(
        "삼육대앞",
        "Sahmyook University Main Gate",
      ),
    },
  },
  {
    routeId: "241347005",
    routeName: "82A",
    source: OFFICIAL_GYEONGGI_ROUTE_SOURCE,
    destinations: {
      "jungmun-up": toward("부대앞", "Budae-ap"),
      "jungmun-down": toward("태릉입구역", "Taereung-ipgu Station"),
      "humun-up": toward("부대앞", "Budae-ap"),
      "humun-down": toward("태릉입구역", "Taereung-ipgu Station"),
    },
  },
  {
    routeId: "241347006",
    routeName: "82B",
    source: OFFICIAL_GYEONGGI_ROUTE_SOURCE,
    destinations: {
      "jungmun-up": toward("별내차고지", "Byeollae Bus Garage"),
      "jungmun-down": toward("태릉입구역", "Taereung-ipgu Station"),
      "humun-up": toward("별내차고지", "Byeollae Bus Garage"),
      "humun-down": toward("태릉입구역", "Taereung-ipgu Station"),
    },
  },
  {
    routeId: "241347011",
    routeName: "86",
    source: OFFICIAL_GYEONGGI_ROUTE_SOURCE,
    destinations: {
      "humun-up": toward("별내차고지", "Byeollae Bus Garage"),
      "humun-down": terminus(
        "삼육대후문",
        "Sahmyook University Back Gate",
      ),
    },
  },
];

const ROUTE_DESTINATION_MAP = new Map(
  ROUTE_DESTINATIONS.map((route) => [route.routeId, route]),
);

export function getBusRouteDestination(
  stopId: string,
  routeId: string,
): BusRouteDestination | undefined {
  if (!isPublicTransitStopId(stopId)) return undefined;

  const route = ROUTE_DESTINATION_MAP.get(routeId.trim());
  const destination = route?.destinations[stopId];

  return destination ? { ...destination } : undefined;
}

function isPublicTransitStopId(stopId: string): stopId is PublicTransitStopId {
  return (
    stopId === "jungmun-up" ||
    stopId === "jungmun-down" ||
    stopId === "humun-up" ||
    stopId === "humun-down"
  );
}
