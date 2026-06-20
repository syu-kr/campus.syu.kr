"use client";

import { Container } from "@/app/components/Container";

import { Card } from "@/app/components/Card";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { fetchJson } from "@/lib/fetch-json";
import {
  LIBRARY_OPERATING_HOURS,
  ROOM_SEAT_MAP_URLS,
  type LibrarySeason,
  type ReadingRoom,
} from "@/lib/library";
import { fetchShuttleSpecialPeriods } from "@/lib/api";
import { getKoreaNow } from "@/lib/home";
import { isShuttleVacationDate } from "@/lib/shuttle-schedule";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";

type LibraryDictionary = Dictionary["pages"]["library"];

function getUsageColor(percentage: number): string {
  if (percentage >= 66) return "bg-red-600"; // 2/3 이상
  if (percentage >= 33) return "bg-yellow-500"; // 1/3 이상
  return "bg-primary-600"; // 1/3 미만
}

function getUsageLabel(percentage: number, text: LibraryDictionary): string {
  if (percentage >= 66) return text.crowded;
  if (percentage >= 33) return text.normal;
  return text.relaxed;
}

export default function LibraryPage() {
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.pages.library;
  const [selectedSeason, setSelectedSeason] =
    useState<LibrarySeason>("semester");
  const [seatMapUrl, setSeatMapUrl] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(getKoreaNow());

    const timer = setInterval(() => {
      setNow(getKoreaNow());
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, []);

  const { data: shuttleSpecialPeriods } = useQuery({
    queryKey: ["shuttle-special-periods"],
    queryFn: () => fetchShuttleSpecialPeriods(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const {
    data: rooms = [],
    isLoading,
    isFetching,
    isError,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ["library-reading-rooms"],
    queryFn: () =>
      fetchJson<ReadingRoom[]>("/api/library/reading-rooms", {
        fallback: [],
        throwOnError: true,
      }),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const defaultSeason = useMemo<LibrarySeason>(() => {
    if (!now) return "semester";

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const date = String(now.getDate()).padStart(2, "0");
    const dateString = `${year}-${month}-${date}`;

    return isShuttleVacationDate(dateString, shuttleSpecialPeriods)
      ? "vacation"
      : "semester";
  }, [now, shuttleSpecialPeriods]);

  useEffect(() => {
    setSelectedSeason(defaultSeason);
  }, [defaultSeason]);

  const currentHours = LIBRARY_OPERATING_HOURS[selectedSeason];
  const lastUpdatedTime = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString(getLocaleCode(locale))
    : "-";

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          {text.title}
        </h1>
        <p className="text-neutral-600">{text.description}</p>
      </div>

      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-neutral-900">
            {text.readingRoomStatus}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">
              {text.lastUpdated}: {lastUpdatedTime}
            </span>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="rounded bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isFetching ? text.refreshing : text.refresh}
            </button>
          </div>
        </div>

        {isLoading ? (
          <Skeleton count={3} height="60px" />
        ) : rooms.length === 0 ? (
          <StateCard
            type={isError ? "error" : "info"}
            message={
              isError
                ? text.loadError
                : text.emptySeats
            }
          />
        ) : (
          <div className="space-y-4">
            {rooms.map((room, idx) => {
              const hasValidSeatTotal = room.strTotalSeat > 0;
              const usagePercent = hasValidSeatTotal
                ? Math.round((room.strUseSeat / room.strTotalSeat) * 100)
                : 0;
              const roomSeatMapUrl = ROOM_SEAT_MAP_URLS[idx];
              return (
                <div key={idx}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <strong className="text-neutral-900">
                        {room.strRoomNm}
                      </strong>
                      {roomSeatMapUrl && (
                        <button
                          onClick={() => setSeatMapUrl(roomSeatMapUrl)}
                          className="px-2 py-1 text-xs font-medium rounded bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors"
                        >
                          {text.viewSeats}
                        </button>
                      )}
                    </div>
                    <span className="text-right text-sm font-semibold text-neutral-700">
                      {hasValidSeatTotal ? (
                        <>
                          {room.strUseSeat}/{room.strTotalSeat}
                          <span className="ml-1 text-neutral-500">
                            ({usagePercent}%,{" "}
                            {getUsageLabel(usagePercent, text)})
                          </span>
                        </>
                      ) : (
                        text.seatsCheckNeeded
                      )}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-200 rounded h-2">
                    <div
                      className={`${getUsageColor(usagePercent)} h-2 rounded transition-all`}
                      style={{ width: `${usagePercent}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 text-xs text-neutral-500">
          <p>• {text.legendBlue}</p>
          <p>• {text.legendOrange}</p>
          <p>• {text.legendRed}</p>
        </div>
      </Card>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-neutral-900">
            {text.operatingHours}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedSeason("semester")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedSeason === "semester"
                  ? "bg-primary-600 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {text.semester}
            </button>
            <button
              onClick={() => setSelectedSeason("vacation")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedSeason === "vacation"
                  ? "bg-primary-600 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {text.vacation}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {currentHours.floors.map((floor, floorIdx) => (
            <Card key={floorIdx} className="border border-neutral-300">
              <h3 className="font-bold text-neutral-900 mb-4 text-lg">
                {floor.name}
              </h3>
              <div className="space-y-3">
                {floor.rooms.map((room, roomIdx) => (
                  <div
                    key={roomIdx}
                    className="border-t border-neutral-200 pt-3 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-neutral-900">
                        {room.name}
                      </h4>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-2 text-sm">
                      <div>
                        <span className="text-xs text-neutral-500">
                          {text.monThu}
                        </span>
                        <p className="font-medium text-neutral-900">
                          {formatScheduleValue(room.schedule["월-목"], text)}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-neutral-500">
                          {text.friday}
                        </span>
                        <p className="font-medium text-neutral-900">
                          {formatScheduleValue(room.schedule["금"], text)}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-neutral-500">
                          {text.sunday}
                        </span>
                        <p className="font-medium text-neutral-900">
                          {formatScheduleValue(
                            room.schedule["일"] || "휴관",
                            text,
                          )}
                        </p>
                      </div>
                    </div>
                    {room.note && (
                      <p className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
                        {room.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <Card className="mt-6 bg-neutral-50 border border-neutral-300">
          <h3 className="font-semibold text-neutral-900 mb-3">
            {text.noticesTitle}
          </h3>
          <ul className="text-sm text-neutral-700 space-y-1">
            <li>• {text.noticeHoliday}</li>
            <li>• {text.noticeStudyRoom}</li>
            <li>• {text.noticeSchedule}</li>
          </ul>
        </Card>
      </div>

      <Card className="mb-6">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">
          {text.facilitiesTitle}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">{text.facilityLoan}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">{text.facilityPc}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">{text.facilityDatabase}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">{text.facilityPrint}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">{text.facilityLounge}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">{text.facilityRestroom}</span>
          </div>
        </div>
      </Card>

      <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200">
        <h2 className="text-lg font-bold text-blue-900 mb-4">
          {text.guideTitle}
        </h2>
        <div className="space-y-3 text-sm">
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">
              {text.loanTitle}
            </h3>
            <p className="text-blue-800">{text.loanDescription}</p>
          </div>
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">
              {text.readingRoomUseTitle}
            </h3>
            <p className="text-blue-800">{text.readingRoomUseDescription}</p>
          </div>
        </div>
      </Card>

      {seatMapUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl h-[80vh] animate-in fade-in duration-200 flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-neutral-200">
              <h3 className="text-lg font-bold text-neutral-900">
                {text.seatStatusTitle}
              </h3>
              <button
                onClick={() => setSeatMapUrl(null)}
                className="px-3 py-1.5 text-sm font-medium bg-neutral-200 text-neutral-900 rounded-lg hover:bg-neutral-300 transition-colors"
              >
                {text.close}
              </button>
            </div>
            <iframe
              src={seatMapUrl}
              className="flex-1 w-full border-0"
              title={text.seatStatusIframeTitle}
            />
            <div className="border-t border-neutral-200 p-3 text-xs text-neutral-600">
              {text.externalSeatMapPrefix}{" "}
              <a
                href={seatMapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary-600 hover:text-primary-700"
              >
                {text.openInNewTab}
              </a>
              {text.externalSeatMapSuffix}
            </div>
          </div>
        </div>
      )}
    </Container>
  );
}

function getLocaleCode(locale: Locale) {
  return locale === "ko" ? "ko-KR" : "en-US";
}

function formatScheduleValue(value: string, text: LibraryDictionary) {
  return value === "휴관" ? text.closed : value;
}
