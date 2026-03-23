"use client";

import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { Skeleton } from "@/app/components/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { fetchShuttleBuses, fetchBusLocations } from "@/lib/api";
import { BusLocation } from "@/types";
import {
  useState,
  useMemo,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";

export default function ShuttlePage() {
  const { data: buses, isLoading } = useQuery({
    queryKey: ["shuttle-buses"],
    queryFn: () => fetchShuttleBuses(),
    staleTime: 5 * 60 * 1000,
  });

  // 현재 시간을 매초 업데이트
  const [now, setNow] = useState(new Date());
  const [busLocations, setBusLocations] = useState<BusLocation[]>([]);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const mapComponentRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // 버스 위치를 5-10초 랜덤 간격으로 새로고침
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const locations = await fetchBusLocations();
        console.log("✅ Bus locations fetched:", locations);
        setBusLocations(locations);
      } catch (error) {
        console.error("❌ Failed to fetch bus locations:", error);
      }
    };

    // 초기 로드
    fetchLocations();

    // 5-10초 랜덤 간격으로 반복
    const scheduleNextFetch = () => {
      const delay = Math.random() * 5000 + 5000; // 5000~10000ms
      const timeout = setTimeout(() => {
        fetchLocations();
        scheduleNextFetch(); // 재귀적으로 다음 요청 스케줄
      }, delay);
      return timeout;
    };

    const timeoutId = scheduleNextFetch();

    return () => clearTimeout(timeoutId);
  }, []);

  // 현재 날짜/시간 정보
  const dateInfo = useMemo(() => {
    const dayOfWeek = now.getDay(); // 0: 일, 1: 월, ..., 6: 토
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isFriday = dayOfWeek === 5;
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const hour = now.getHours();
    const minute = now.getMinutes();

    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

    return {
      dayOfWeek,
      isWeekend,
      isFriday,
      currentTime,
      hour,
      minute,
      dayName: dayNames[dayOfWeek],
    };
  }, [now]);

  // 초기 선택 상태 (현재 요일에 따라)
  const defaultType = useMemo(() => {
    if (dateInfo.isWeekend) return "mondayToThursday"; // 주말이면 월요일 시간표 표시
    if (dateInfo.isFriday) return "friday";
    return "mondayToThursday";
  }, [dateInfo]);

  const [selectedType, setSelectedType] = useState<
    | "mondayToThursday"
    | "friday"
    | "mondayToThursdayVacation"
    | "fridayVacation"
  >(defaultType);

  // 시간 문자열을 분 단위로 변환
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  };

  // 노선별 가장 빨리 출발하는 버스 (30분 이내인 경우만)
  const nextBusesWithin30Min = useMemo((): Array<{
    routeName: string;
    time: string;
    minutesUntil: number;
  }> => {
    if (
      !buses ||
      buses.length === 0 ||
      dateInfo.isWeekend ||
      selectedType !== defaultType
    )
      return [];

    const currentMinutes = dateInfo.hour * 60 + dateInfo.minute;
    const busesByRoute = new Map<
      string,
      { time: string; minutesUntil: number }
    >();

    // 각 노선별로 첫 번째 버스(가장 빨리 출발)를 찾기
    buses.forEach((bus) => {
      const times = bus.schedules[selectedType];

      for (const time of times) {
        const timeMinutes = timeToMinutes(time);
        const minutesUntil = timeMinutes - currentMinutes;

        // 첫 번째 다음 버스를 찾으면 저장하고 다음 노선으로
        if (minutesUntil > 0) {
          busesByRoute.set(bus.routeName, { time, minutesUntil });
          break;
        }
      }
    });

    // Map을 배열로 변환하고, 30분 이내인 것만 필터링
    const result = Array.from(busesByRoute.entries())
      .filter(([, { minutesUntil }]) => minutesUntil <= 30)
      .map(([routeName, { time, minutesUntil }]) => ({
        routeName,
        time,
        minutesUntil,
      }))
      // 시간순으로 정렬
      .sort((a, b) => a.minutesUntil - b.minutesUntil);

    return result;
  }, [buses, dateInfo, selectedType, defaultType]);

  // 노선별 가장 빨리 오는 버스 시간 (하이라이트용)
  const nextBusTimeByRoute = useMemo((): Map<string, string> => {
    if (
      !buses ||
      buses.length === 0 ||
      dateInfo.isWeekend ||
      selectedType !== defaultType
    )
      return new Map();

    const currentMinutes = dateInfo.hour * 60 + dateInfo.minute;
    const timeByRoute = new Map<string, string>();

    buses.forEach((bus) => {
      const times = bus.schedules[selectedType];

      // 각 노선별로 첫 번째 다음 버스 찾기
      for (const time of times) {
        const timeMinutes = timeToMinutes(time);
        const minutesUntil = timeMinutes - currentMinutes;

        if (minutesUntil > 0) {
          timeByRoute.set(bus.routeName, time);
          break;
        }
      }
    });

    return timeByRoute;
  }, [buses, dateInfo, selectedType, defaultType]);

  // 요일 버튼 클릭 시
  const dayButtons = [
    {
      type: "mondayToThursday" as const,
      label: "학기(월-목)",
      isActive: !dateInfo.isWeekend && !dateInfo.isFriday ? "현재" : "",
    },
    {
      type: "friday" as const,
      label: "학기(금)",
      isActive: dateInfo.isFriday ? "현재" : "",
    },
    {
      type: "mondayToThursdayVacation" as const,
      label: "방학(월-목)",
      isActive: "",
    },
    {
      type: "fridayVacation" as const,
      label: "방학(금)",
      isActive: "",
    },
  ];

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          셔틀버스
        </h1>
        <p className="text-neutral-600">
          캠퍼스 셔틀버스 운행 시간표 (오늘: {dateInfo.dayName}요일)
        </p>
      </div>

      {/* 주말 안내 */}
      {dateInfo.isWeekend && (
        <Card className="mb-6 bg-orange-50 border border-orange-300">
          <p className="text-sm text-orange-900">
            <strong>안내:</strong> 오늘은 주말입니다. 셔틀버스가 운행되지
            않습니다.
          </p>
        </Card>
      )}

      {/* 다음 버스 정보 */}
      {nextBusesWithin30Min.length > 0 && !dateInfo.isWeekend ? (
        <>
          <Card className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400">
            <div className="mb-3">
              <p className="text-xs sm:text-sm text-green-700 font-semibold mb-2">
                곧 출발하는 버스
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {nextBusesWithin30Min.map((bus, idx) => (
                <div
                  key={idx}
                  className="bg-white border-2 border-green-300 rounded-lg p-3 sm:p-4"
                >
                  <h3 className="text-base sm:text-lg font-bold text-green-900 mb-2">
                    {bus.routeName}
                  </h3>
                  <div className="space-y-1">
                    <p className="text-sm sm:text-base text-green-800">
                      <strong>{bus.time}</strong> 출발
                    </p>
                    <p className="text-sm sm:text-base font-semibold text-green-600">
                      {bus.minutesUntil}분 후 출발
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 실시간 버스 위치 지도 */}
          {busLocations.length > 0 && (
            <Card className="mb-6">
              <div className="mb-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-3 sm:gap-0">
                  <h2 className="text-lg sm:text-xl font-bold text-neutral-900">
                    실시간 버스 위치
                  </h2>
                  <div className="flex flex-wrap gap-2 sm:gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: "#3b82f6" }}
                      ></div>
                      <span className="text-neutral-600">화랑대행</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: "#10b981" }}
                      ></div>
                      <span className="text-neutral-600">석계행</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: "#f59e0b" }}
                      ></div>
                      <span className="text-neutral-600">별내행</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: "#d0d0d0" }}
                      ></div>
                      <span className="text-neutral-600">캠퍼스행</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-neutral-600">
                  5-10초마다 자동으로 업데이트됩니다
                </p>
              </div>

              {/* 카카오맵 지도 */}
              <div
                id="shuttle-map"
                className="w-full h-80 sm:h-96 md:h-[500px] rounded-lg border border-neutral-200 overflow-hidden mb-4"
                style={{ minHeight: "320px" }}
              />

              {/* 버스 위치 목록 */}
              <div className="space-y-2">
                {busLocations
                  .filter((bus) => bus.status !== 0)
                  .sort((a, b) => parseInt(a.name) - parseInt(b.name))
                  .map((bus) => {
                    const routeNames: Record<string | number, string> = {
                      1: "화랑대역",
                      2: "석계역",
                      3: "별내역",
                    };
                    const statusLabels: Record<number, string> = {
                      1: "학교 → 역",
                      2: "역 → 출발",
                    };
                    const statusColors: Record<number, string> = {
                      1: "bg-blue-100 text-blue-700",
                      2: "bg-gray-200 text-gray-600",
                    };

                    return (
                      <div
                        key={bus.id}
                        onClick={() => {
                          setSelectedBusId(bus.id);
                          mapComponentRef.current?.openMarker(bus.id);
                        }}
                        className={`p-3 sm:p-4 rounded-lg border flex justify-between items-center gap-3 cursor-pointer transition-all hover:shadow-md ${statusColors[bus.status] || "bg-gray-100"}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm sm:text-base truncate">
                            {routeNames[bus.routeid]}
                          </p>
                        </div>
                        <span className="text-xs sm:text-sm font-medium whitespace-nowrap flex-shrink-0">
                          {statusLabels[bus.status] || "알 수 없음"}
                        </span>
                      </div>
                    );
                  })}
              </div>

              {/* Leaflet 지도 초기화 스크립트 */}
              <MapComponent
                ref={mapComponentRef}
                busLocations={busLocations}
                selectedBusId={selectedBusId}
              />
            </Card>
          )}
        </>
      ) : null}

      {/* 요일 선택 */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        {dayButtons.map((btn) => (
          <button
            key={btn.type}
            onClick={() => setSelectedType(btn.type)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
              selectedType === btn.type
                ? "bg-primary-600 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            {btn.label}
            {btn.isActive && (
              <span className="ml-1 text-xs bg-green-600 px-2 py-0.5 rounded-full">
                {btn.isActive}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 방학 운행 안내 */}
      {(selectedType === "mondayToThursdayVacation" ||
        selectedType === "fridayVacation") && (
        <Card className="mb-4 bg-yellow-50 border border-yellow-200 text-sm text-yellow-900">
          <p>방학 중 시간표입니다. 운행 시간이 다를 수 있습니다.</p>
        </Card>
      )}

      {/* 운행 시간표 */}
      <div className="space-y-4">
        {isLoading && <Skeleton count={3} height="150px" />}

        {!isLoading && buses && buses.length === 0 && (
          <Card>
            <div className="py-8 text-center">
              <p className="text-neutral-600">
                버스 정보를 불러올 수 없습니다.
              </p>
            </div>
          </Card>
        )}

        {!isLoading &&
          buses &&
          buses.map((bus) => {
            const times = bus.schedules[selectedType];

            return (
              <Card key={bus.id}>
                <div className="mb-4">
                  <h2 className="text-lg font-bold text-neutral-900 mb-1">
                    {bus.routeName}
                  </h2>
                  <p className="text-sm text-neutral-600">
                    {bus.startLocation} → {bus.endLocation}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-neutral-500 font-semibold mb-3 uppercase tracking-wide">
                    운행 시간
                  </p>
                  {times.length === 0 ? (
                    <div className="bg-neutral-100 border border-neutral-300 rounded-lg px-4 py-6 text-center">
                      <p className="text-sm text-neutral-600 font-medium">
                        이 날짜에는 운행되지 않습니다.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {times.map((time, idx) => {
                        const timeMinutes = timeToMinutes(time);
                        const currentMinutes =
                          dateInfo.hour * 60 + dateInfo.minute;
                        const minutesUntil = timeMinutes - currentMinutes;

                        // 이 노선의 가장 빨리 오는 버스인지 확인
                        const nextBusTime = nextBusTimeByRoute.get(
                          bus.routeName,
                        );
                        const isNextBus = nextBusTime === time;
                        const isWithin30Min =
                          isNextBus &&
                          minutesUntil <= 30 &&
                          selectedType === defaultType &&
                          !dateInfo.isWeekend;

                        const isPassed =
                          timeMinutes <= currentMinutes &&
                          selectedType === defaultType;

                        return (
                          <div
                            key={idx}
                            className={`rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
                              isWithin30Min
                                ? "bg-green-100 border-2 border-green-500 text-green-700 font-bold"
                                : isPassed
                                  ? "bg-gray-100 border border-gray-300 text-gray-500 line-through"
                                  : "bg-primary-50 border border-primary-200 text-primary-700"
                            }`}
                          >
                            {time}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <p className="text-xs text-neutral-500 mt-3">
                  최종 업데이트: {bus.lastUpdated}
                </p>
              </Card>
            );
          })}
      </div>

      {/* 안내 */}
      <Card className="mt-8 bg-blue-50 border border-blue-200">
        <p className="text-sm text-blue-900 mb-2">
          <strong>안내:</strong> 셔틀버스 운행 시간은 학기 또는 행사에 따라
          변경될 수 있습니다.
        </p>
        <p className="text-xs text-blue-800">
          정확한 정보는 캠퍼스 공지사항을 확인해주세요.
        </p>
      </Card>
    </Container>
  );
}

// 카카오맵 지도 컴포넌트
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MapComponent = forwardRef(
  (
    {
      busLocations,
      selectedBusId,
    }: {
      busLocations: BusLocation[];
      selectedBusId: string | null;
    },
    ref: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  ) => {
    const mapRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
    const markersRef = useRef<Map<string, any>>(new Map()); // eslint-disable-line @typescript-eslint/no-explicit-any
    const infowindowsRef = useRef<Map<string, any>>(new Map()); // eslint-disable-line @typescript-eslint/no-explicit-any
    const currentInfoWindowRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
    const [mapLoaded, setMapLoaded] = useState(false);

    // SDK 로드 (변경 없음)
    useEffect(() => {
      const kakaoMapKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

      if (!kakaoMapKey) {
        console.error("Kakao Map API Key is not configured");
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).kakao?.maps) {
        setMapLoaded(true);
        return;
      }

      const script = document.createElement("script");
      script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoMapKey}&libraries=services`;
      script.async = true;

      script.onload = () => {
        console.log("Kakao Map API loaded successfully");
        setMapLoaded(true);
      };

      script.onerror = () => {
        console.error("Failed to load Kakao Map API");
      };

      document.head.appendChild(script);

      return () => {
        // 스크립트 제거하지 않음
      };
    }, []);

    // 지도 한 번만 초기화
    useEffect(() => {
      if (!mapLoaded || mapRef.current) return;

      const kakao = (window as any).kakao; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!kakao?.maps) return;

      const mapContainer = document.getElementById("shuttle-map");
      if (!mapContainer) return;

      try {
        const center = new kakao.maps.LatLng(37.64, 127.11);
        const mapOptions = {
          center: center,
          level: 5,
        };

        const map = new kakao.maps.Map(mapContainer, mapOptions);
        mapRef.current = map;
        console.log("Map initialized once");
      } catch (error) {
        console.error("Error initializing map:", error);
      }
    }, [mapLoaded]);

    // 마커 업데이트 (busLocations 변경 시만)
    useEffect(() => {
      if (!mapRef.current) return;

      const kakao = (window as any).kakao; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!kakao?.maps) return;

      const routeColors: Record<string | number, string> = {
        1: "#3b82f6",
        2: "#10b981",
        3: "#f59e0b",
      };

      const routeNames: Record<string | number, string> = {
        1: "화랑대역",
        2: "석계역",
        3: "별내역",
      };

      const statusLabels: Record<number, string> = {
        1: "학교 → 역",
        2: "역 → 출발",
      };

      // 기존 마커 제거
      markersRef.current.forEach((markerData) => {
        markerData.marker.setMap(null);
        markerData.infowindow.close();
      });
      markersRef.current.clear();
      currentInfoWindowRef.current = null;

      // 새 마커 추가
      busLocations
        .filter((bus) => bus.status !== 0)
        .forEach((bus) => {
          const lat = Number(bus.lat);
          const lon = Number(bus.lon);
          const color =
            bus.status === 2
              ? "#d0d0d0"
              : routeColors[bus.routeid] || "#999999";
          const routeName = routeNames[bus.routeid] || "알 수 없음";
          const statusLabel = statusLabels[bus.status] || "알 수 없음";

          const markerPosition = new kakao.maps.LatLng(lat, lon);

          const svgMarker = `
            <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 0C9 0 0 9 0 20c0 15 20 30 20 30s20-15 20-30c0-11-9-20-20-20z" fill="${color}"/>
              <circle cx="20" cy="20" r="8" fill="white"/>
            </svg>
          `;

          const markerImage = new kakao.maps.MarkerImage(
            `data:image/svg+xml;base64,${btoa(svgMarker)}`,
            new kakao.maps.Size(40, 50),
            { offset: new kakao.maps.Point(20, 50) },
          );

          const marker = new kakao.maps.Marker({
            position: markerPosition,
            title: routeName,
            image: markerImage,
          });

          marker.setMap(mapRef.current);

          const infowindowContent = `
          <div style="
            width: 160px;
            padding: 12px;
            border-radius: 8px;
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            font-size: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
          ">
            <p style="margin: 0 0 4px 0; font-weight: bold; font-size: 14px; color: #000;">${routeName}</p>
            <p style="margin: 0; color: #333;"><span style="font-weight: 600;">상태:</span> <span style="color: ${color}; font-weight: 500;">${statusLabel}</span></p>
          </div>
        `;

          const infowindow = new kakao.maps.InfoWindow({
            content: infowindowContent,
            removable: true,
            zIndex: 1,
          });

          kakao.maps.event.addListener(marker, "click", () => {
            // 이전 InfoWindow 닫기
            if (currentInfoWindowRef.current) {
              currentInfoWindowRef.current.close();
            }
            infowindow.open(mapRef.current, marker);
            currentInfoWindowRef.current = infowindow;
          });

          markersRef.current.set(bus.id, { marker, infowindow });
          infowindowsRef.current.set(bus.id, infowindow);
        });

      // 지도 범위 설정
      const activeBuses = busLocations.filter((bus) => bus.status !== 0);
      if (activeBuses.length > 0) {
        const bounds = new kakao.maps.LatLngBounds();
        activeBuses.forEach((bus) => {
          bounds.extend(
            new kakao.maps.LatLng(Number(bus.lat), Number(bus.lon)),
          );
        });
        mapRef.current.setBounds(bounds);
      }
    }, [busLocations]);

    // 선택된 버스 마커 열기
    useEffect(() => {
      if (!selectedBusId || !mapRef.current) return;

      const markerData = markersRef.current.get(selectedBusId);
      if (markerData) {
        // 이전 InfoWindow 닫기
        if (currentInfoWindowRef.current) {
          currentInfoWindowRef.current.close();
        }
        const { marker, infowindow } = markerData;
        infowindow.open(mapRef.current, marker);
        currentInfoWindowRef.current = infowindow;
        mapRef.current.panTo(marker.getPosition());
      }
    }, [selectedBusId]);

    // 외부에서 호출 가능한 메서드
    useImperativeHandle(ref, () => ({
      openMarker: (busId: string) => {
        const markerData = markersRef.current.get(busId);
        if (markerData && mapRef.current) {
          // 이전 InfoWindow 닫기
          if (currentInfoWindowRef.current) {
            currentInfoWindowRef.current.close();
          }
          const { marker, infowindow } = markerData;
          infowindow.open(mapRef.current, marker);
          currentInfoWindowRef.current = infowindow;
          mapRef.current.panTo(marker.getPosition());
        }
      },
    }));

    return null;
  },
);

MapComponent.displayName = "MapComponent";
