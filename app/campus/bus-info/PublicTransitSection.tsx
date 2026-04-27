"use client";

import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetch-json";
import { BusArrivalsAtStop, BusArrival } from "@/types";
import { useState, useMemo } from "react";
import clsx from "clsx";
import BusDetailModal from "./BusDetailModal";

interface EnrichedBusArrival extends BusArrival {
  minArrivalTime: number; // 첫번째 도착까지 초 단위
}

const TRANSIT_STOPS = [
  { id: "jungmun-up", label: "정문 상행" },
  { id: "jungmun-down", label: "정문 하행" },
  { id: "humun-up", label: "후문 상행" },
  { id: "humun-down", label: "후문 하행" },
];

export default function PublicTransitSection() {
  const [selectedStopId, setSelectedStopId] = useState<string>("jungmun-up");
  const [selectedBus, setSelectedBus] = useState<BusArrival | null>(null);
  const [selectedBusDirection, setSelectedBusDirection] = useState<
    "up" | "down" | null
  >(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 10초마다 자동 갱신
  const {
    data: arrivals = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["public-transit-arrivals"],
    queryFn: async () => {
      const json = await fetchJson<{
        success: boolean;
        data: Array<BusArrivalsAtStop & { lastUpdated: string }>;
      }>("/api/bus/public-transit", { fallback: { success: false, data: [] } });

      return (json.data || []).map((item) => ({
        ...item,
        lastUpdated: new Date(item.lastUpdated),
      }));
    },
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  });

  const lastUpdated = useMemo(() => {
    if (!arrivals.length) return null;
    const latest = Math.max(
      ...arrivals.map((item) => new Date(item.lastUpdated).getTime()),
    );
    return Number.isFinite(latest) ? new Date(latest) : null;
  }, [arrivals]);

  const selectedStop = useMemo(
    () =>
      arrivals.find((s) => {
        const stopId = s.stop.id;
        return selectedStopId === "jungmun-up"
          ? stopId.includes("jungmun") && s.stop.direction === "up"
          : selectedStopId === "jungmun-down"
            ? stopId.includes("jungmun") && s.stop.direction === "down"
            : selectedStopId === "humun-up"
              ? stopId.includes("humun") && s.stop.direction === "up"
              : selectedStopId === "humun-down"
                ? stopId.includes("humun") && s.stop.direction === "down"
                : false;
      }),
    [arrivals, selectedStopId],
  );

  // 도착 시간순으로 정렬된 버스들 (운행 중인 버스 우선, 정보 없음은 마지막)
  const sortedArrivals: EnrichedBusArrival[] = useMemo(
    () =>
      (selectedStop?.arrivals || [])
        .map((arrival) => ({
          ...arrival,
          minArrivalTime:
            arrival.predictTime1 && arrival.predictTime1 > 0
              ? arrival.predictTime1
              : Infinity,
        }))
        .sort((a, b) => a.minArrivalTime - b.minArrivalTime),
    [selectedStop],
  );

  // 운행 중(도착예정 시간 존재) 노선만 표시
  const activeArrivals = useMemo(
    () =>
      sortedArrivals.filter(
        (arrival) =>
          typeof arrival.predictTime1 === "number" && arrival.predictTime1 > 0,
      ),
    [sortedArrivals],
  );

  return (
    <Container className="py-4 sm:py-8">
      {/* 헤더 - 개선된 디자인 */}
      <div className="mb-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 sm:p-6 border border-blue-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 mb-1">
              대중교통 안내
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 mb-3">
              삼육대학교 주변 버스 실시간 도착 정보
            </p>
            <div className="text-xs text-neutral-500 flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              마지막 업데이트:{" "}
              {lastUpdated ? lastUpdated.toLocaleTimeString("ko-KR") : "-"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            title="새로고침"
            aria-label="대중교통 정보 새로고침"
            className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-white text-blue-700 shadow-sm transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshIcon className={isFetching ? "animate-spin" : undefined} />
          </button>
        </div>
      </div>

      {/* 오류 상태 */}
      {error && (
        <Card className="bg-red-50 border border-red-200 mb-6">
          <div className="text-red-700 text-sm font-medium">
            <strong>정보를 가져올 수 없습니다</strong>
            <p className="mt-1">
              API 키가 설정되지 않았거나 일시적 오류가 발생했습니다.
            </p>
            <button
              onClick={() => refetch()}
              className="mt-3 px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition"
            >
              재시도
            </button>
          </div>
        </Card>
      )}

      {/* 정류장 선택 토글 - 모바일 개선 */}
      {!isLoading && (
        <div className="mb-4 -mx-4 px-4 overflow-x-auto">
          <div className="flex gap-2 min-w-max pb-2">
            {TRANSIT_STOPS.map((stop) => (
              <button
                key={stop.id}
                onClick={() => setSelectedStopId(stop.id)}
                className={clsx(
                  "px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all",
                  selectedStopId === stop.id
                    ? "bg-blue-500 text-white shadow-md scale-100"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
                )}
              >
                {stop.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 버스 도착 정보 */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <div className="bg-neutral-200 h-16 rounded animate-pulse" />
            </Card>
          ))}
        </div>
      ) : sortedArrivals.length === 0 ? (
        <Card className="bg-neutral-50 border border-neutral-200">
          <div className="text-center py-8 text-neutral-600">
            <p>표시 가능한 노선 정보가 없습니다</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeArrivals.length === 0 && (
            <Card className="bg-amber-50 border border-amber-200">
              <div className="text-amber-800 text-sm font-medium">
                현재 운행중인 버스는 없습니다.
                <p className="mt-1 text-xs text-amber-700">
                  아래에는 운행종료/정보없음을 포함한 전체 노선 상태를
                  표시합니다.
                </p>
              </div>
            </Card>
          )}

          {sortedArrivals.map((arrival, idx) => {
            // 운행 정보 확인
            const isNoInfo =
              !arrival.predictTime1 ||
              arrival.predictTime1 <= 0 ||
              arrival.arrivalMsg1 === "정보 없음";

            const statusLabel = isNoInfo
              ? arrival.arrivalMsg1?.includes("운행종료")
                ? "운행종료"
                : "정보없음"
              : "운행중";

            // 좌석 혼잡도
            const seatStatus =
              arrival.crowded1 === undefined || arrival.crowded1 < 0
                ? { label: "정보 없음", color: "bg-gray-100 text-gray-700" }
                : arrival.crowded1 === 0
                  ? { label: "여유", color: "bg-green-100 text-green-700" }
                  : arrival.crowded1 === 1
                    ? { label: "보통", color: "bg-yellow-100 text-yellow-700" }
                    : { label: "혼잡", color: "bg-red-100 text-red-700" };

            // 방향에 따른 고정 행선지
            const fixedDestination =
              selectedStop?.stop.id.includes("jungmun") &&
              selectedStop?.stop.direction === "up"
                ? "담터고개 행"
                : selectedStop?.stop.id.includes("jungmun") &&
                    selectedStop?.stop.direction === "down"
                  ? "태릉국제스케이트장 행"
                  : selectedStop?.stop.id.includes("humun") &&
                      selectedStop?.stop.direction === "up"
                    ? "미리내마을4-2단지.한별초등학교 행"
                    : selectedStop?.stop.id.includes("humun") &&
                        selectedStop?.stop.direction === "down"
                      ? "태릉국제스케이트장 행"
                      : "";

            return (
              <Card
                key={`${arrival.routeId}-${idx}`}
                onClick={() => {
                  setSelectedBus(arrival);
                  setSelectedBusDirection(
                    selectedStop?.stop.direction as "up" | "down",
                  );
                  setIsModalOpen(true);
                }}
                className={clsx(
                  "p-3 sm:p-4 hover:shadow-card-hover transition-shadow border-l-4 cursor-pointer",
                  isNoInfo
                    ? "border-l-gray-300 hover:bg-gray-50"
                    : arrival.locationNo1 === 1
                      ? "border-l-red-500 hover:bg-red-50"
                      : "border-l-blue-500 hover:bg-blue-50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* 노선명 [저상여부] */}
                    <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                      <p
                        className={clsx(
                          "font-bold text-base sm:text-lg",
                          isNoInfo ? "text-neutral-500" : "text-neutral-900",
                        )}
                      >
                        {arrival.routeName}
                      </p>
                      <span
                        className={clsx(
                          "text-xs px-2 py-0.5 rounded font-medium",
                          statusLabel === "운행중"
                            ? "bg-blue-100 text-blue-700"
                            : statusLabel === "운행종료"
                              ? "bg-gray-200 text-gray-700"
                              : "bg-amber-100 text-amber-700",
                        )}
                      >
                        {statusLabel}
                      </span>
                      {arrival.isLow1 && !isNoInfo && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">
                          저상
                        </span>
                      )}
                    </div>

                    {/* 행선지 */}
                    <p
                      className={clsx(
                        "text-xs sm:text-sm mb-2 truncate",
                        isNoInfo ? "text-neutral-400" : "text-neutral-600",
                      )}
                    >
                      {fixedDestination}
                    </p>

                    {/* 도착 정보 */}
                    {isNoInfo ? (
                      <p className="text-xs sm:text-sm text-neutral-500 font-medium">
                        도착 예정 정보 없음
                      </p>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs sm:text-sm text-blue-600 font-semibold">
                            {arrival.locationNo1 && arrival.locationNo1 > 0
                              ? `${arrival.locationNo1}정거장 전 | `
                              : ""}
                            {Math.ceil(arrival.predictTime1 || 0)}분 후
                          </p>
                        </div>

                        {/* 두번째 버스 정보 */}
                        {arrival.predictTime2 &&
                          arrival.predictTime2 > 0 &&
                          arrival.predictTime2 < Infinity && (
                            <p className="text-xs text-neutral-500 mt-1">
                              다음:{" "}
                              {arrival.locationNo2 && arrival.locationNo2 > 0
                                ? `${arrival.locationNo2}정거장 전 | `
                                : ""}
                              {Math.ceil(arrival.predictTime2)}분 후
                            </p>
                          )}
                      </>
                    )}
                  </div>

                  {/* 좌석 상태 배지 */}
                  {!isNoInfo && (
                    <div className="ml-2 flex-shrink-0">
                      <span
                        className={clsx(
                          "px-2 sm:px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap",
                          seatStatus.color,
                        )}
                      >
                        {seatStatus.label}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 안내 메시지 - 개선된 디자인 */}
      <div className="mt-6 p-3 sm:p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
        <div className="space-y-2">
          <p className="text-xs sm:text-sm text-green-900 font-medium flex items-center gap-2">
            정보는 10초마다 자동으로 새로고침됩니다
          </p>
          <p className="text-xs text-green-700">
            데이터 출처: 경기도 공공데이터포털
          </p>
        </div>
      </div>

      {/* 버스 상세 정보 모달 */}
      <BusDetailModal
        bus={selectedBus}
        direction={selectedBusDirection}
        stopId={selectedStop?.stop.id}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedBus(null);
          setSelectedBusDirection(null);
        }}
      />
    </Container>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}
