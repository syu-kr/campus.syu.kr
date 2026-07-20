"use client";

import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { LiveDataStatusBadge } from "@/app/components/LiveDataStatusBadge";
import { StateCard } from "@/app/components/StateCard";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetch-json";
import { BusArrivalsAtStop, BusArrival } from "@/types";
import { useState, useMemo, type KeyboardEvent } from "react";
import clsx from "clsx";
import BusDetailModal from "./BusDetailModal";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import type { Dictionary } from "@/lib/i18n";
import type { LiveDataResponse } from "@/types/live-data";

interface EnrichedBusArrival extends BusArrival {
  minArrivalTime: number; // 첫번째 도착까지 초 단위
}

type BusInfoDictionary = Dictionary["pages"]["busInfo"];
type TransitStopLabelKey = keyof BusInfoDictionary["stopLabels"];
type SerializedBusArrivalsAtStop = Omit<BusArrivalsAtStop, "lastUpdated"> & {
  lastUpdated: string;
};
type TransitStatusPayload = LiveDataResponse<BusArrivalsAtStop[]>;
type SerializedTransitStatusPayload =
  LiveDataResponse<SerializedBusArrivalsAtStop[]>;

const EMPTY_TRANSIT_STATUS: TransitStatusPayload = {
  success: false,
  source: "public-transit-arrivals",
  data: [],
  timestamp: "",
  stale: false,
  sourceStatus: "fresh",
};

const TRANSIT_STOPS = [
  { id: "jungmun-up", labelKey: "jungmunUp" },
  { id: "jungmun-down", labelKey: "jungmunDown" },
  { id: "humun-up", labelKey: "humunUp" },
  { id: "humun-down", labelKey: "humunDown" },
] as const satisfies ReadonlyArray<{
  id: string;
  labelKey: TransitStopLabelKey;
}>;

export default function PublicTransitSection() {
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.pages.busInfo;
  const [selectedStopId, setSelectedStopId] = useState<string>("jungmun-up");
  const [selectedBus, setSelectedBus] = useState<BusArrival | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 10초마다 자동 갱신
  const {
    data: transitStatus = EMPTY_TRANSIT_STATUS,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["public-transit-arrivals", locale],
    queryFn: async () => {
      const json = await fetchJson<SerializedTransitStatusPayload>(
        "/api/bus/public-transit",
        {
          fallback: {
            ...EMPTY_TRANSIT_STATUS,
            data: [],
          },
        },
      );

      if (!json.success) {
        throw new Error(json.error ?? text.transitLoadFailed);
      }

      return {
        ...json,
        data: (json.data || []).map((item) => ({
          ...item,
          lastUpdated: new Date(item.lastUpdated),
        })),
      };
    },
    staleTime: 10000,
    gcTime: 60 * 1000,
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });
  const arrivals = transitStatus.data;
  const hasTransitSourceIssue =
    transitStatus.stale || transitStatus.sourceStatus === "error";

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

  const openBusDetail = (arrival: BusArrival) => {
    setSelectedBus(arrival);
    setIsModalOpen(true);
  };

  const handleBusCardKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    arrival: BusArrival,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    openBusDetail(arrival);
  };

  return (
    <Container className="py-4 sm:py-8">
      <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 mb-1">
              {text.publicTransitTitle}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 mb-3">
              {text.publicTransitDescription}
            </p>
            {!isLoading && (
              <LiveDataStatusBadge
                locale={locale}
                sourceLabel={dictionary.liveData.sources.publicTransit}
                timestamp={transitStatus.timestamp}
                stale={transitStatus.stale}
                sourceStatus={error ? "error" : transitStatus.sourceStatus}
              />
            )}
            <p className="mt-2 text-xs leading-5 text-neutral-500">
              {text.transitSourceNotice}
              <br />
              {text.transitAutoRefresh}
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            title={text.refresh}
            aria-label={text.refreshTransit}
            className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-primary-700 shadow-sm transition-colors hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshIcon className={isFetching ? "animate-spin" : undefined} />
          </button>
        </div>
      </div>

      {error && (
        <StateCard
          type="error"
          className="mb-6"
          title={text.infoUnavailableTitle}
          message={text.infoUnavailableMessage}
          action={
            <button
              type="button"
              onClick={() => refetch()}
              className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition"
            >
              {text.retry}
            </button>
          }
        />
      )}

      {!isLoading && !error && (
        <div className="mb-4 -mx-4 px-4 overflow-x-auto">
          <div className="flex gap-2 min-w-max pb-2">
            {TRANSIT_STOPS.map((stop) => (
              <button
                key={stop.id}
                type="button"
                onClick={() => setSelectedStopId(stop.id)}
                className={clsx(
                  "px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all",
                  selectedStopId === stop.id
                    ? "bg-primary-600 text-white shadow-sm"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
                )}
              >
                {text.stopLabels[stop.labelKey]}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <div className="bg-neutral-200 h-16 rounded animate-pulse" />
            </Card>
          ))}
        </div>
      ) : error ? null : sortedArrivals.length === 0 ? (
        <StateCard
          type={hasTransitSourceIssue ? "warning" : "info"}
          title={hasTransitSourceIssue ? text.infoUnavailableTitle : undefined}
          message={
            hasTransitSourceIssue
              ? text.transitPartialUnavailableMessage
              : text.noTransitInfo
          }
        />
      ) : (
        <div className="space-y-3">
          {activeArrivals.length === 0 && (
            <Card className="bg-amber-50 border border-amber-200">
              <div className="text-amber-800 text-sm font-medium">
                {text.noActiveBus}
                <p className="mt-1 text-xs text-amber-700">
                  {text.allRouteStatusHint}
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
                ? text.ended
                : text.noInfoCompact
              : text.running;

            // 좌석 혼잡도
            const seatStatus =
              arrival.crowded1 === undefined || arrival.crowded1 < 0
                ? { label: text.noInfo, color: "bg-gray-100 text-gray-700" }
                : arrival.crowded1 === 0
                  ? { label: text.relaxed, color: "bg-green-100 text-green-700" }
                  : arrival.crowded1 === 1
                    ? { label: text.normal, color: "bg-yellow-100 text-yellow-700" }
                    : { label: text.crowded, color: "bg-red-100 text-red-700" };

            const destination =
              locale === "ko"
                ? arrival.destination?.labelKo
                : arrival.destination?.labelEn;

            return (
              <Card
                key={`${arrival.routeId}-${idx}`}
                role="button"
                tabIndex={0}
                aria-label={[arrival.routeName, statusLabel, destination]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => openBusDetail(arrival)}
                onKeyDown={(event) => handleBusCardKeyDown(event, arrival)}
                className={clsx(
                  "p-3 sm:p-4 hover:shadow-card-hover transition-shadow border-l-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
                  isNoInfo
                    ? "border-l-gray-300 hover:bg-gray-50"
                    : arrival.locationNo1 === 1
                      ? "border-l-red-500 hover:bg-red-50"
                      : "border-l-blue-500 hover:bg-blue-50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
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
                          statusLabel === text.running
                            ? "bg-blue-100 text-blue-700"
                            : statusLabel === text.ended
                              ? "bg-gray-200 text-gray-700"
                              : "bg-amber-100 text-amber-700",
                        )}
                      >
                        {statusLabel}
                      </span>
                      {arrival.isLow1 && !isNoInfo && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">
                          {text.lowFloor}
                        </span>
                      )}
                    </div>

                    {destination && (
                      <p
                        className={clsx(
                          "text-xs sm:text-sm mb-2 truncate",
                          isNoInfo ? "text-neutral-400" : "text-neutral-600",
                        )}
                      >
                        {destination}
                      </p>
                    )}

                    {isNoInfo ? (
                      <p className="text-xs sm:text-sm text-neutral-500 font-medium">
                        {text.noArrivalInfo}
                      </p>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs sm:text-sm text-blue-600 font-semibold">
                            {arrival.locationNo1 && arrival.locationNo1 > 0
                              ? `${arrival.locationNo1}${
                                  locale === "ko" ? "" : " "
                                }${text.stopsBefore} | `
                              : ""}
                            {Math.ceil(arrival.predictTime1 || 0)}
                            {locale === "ko" ? "" : " "}
                            {text.minutesAfter}
                          </p>
                        </div>

                        {arrival.predictTime2 &&
                          arrival.predictTime2 > 0 &&
                          arrival.predictTime2 < Infinity && (
                            <p className="text-xs text-neutral-500 mt-1">
                              {text.next}{" "}
                              {arrival.locationNo2 && arrival.locationNo2 > 0
                                ? `${arrival.locationNo2}${
                                    locale === "ko" ? "" : " "
                                  }${text.stopsBefore} | `
                                : ""}
                              {Math.ceil(arrival.predictTime2)}
                              {locale === "ko" ? "" : " "}
                              {text.minutesAfter}
                            </p>
                          )}
                      </>
                    )}
                  </div>

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

      <BusDetailModal
        bus={selectedBus}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedBus(null);
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
      focusable="false"
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}
