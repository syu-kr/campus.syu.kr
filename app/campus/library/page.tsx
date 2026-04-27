"use client";

import { Container } from "@/app/components/Container";

import { Card } from "@/app/components/Card";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { fetchJson } from "@/lib/fetch-json";
import {
  LIBRARY_OPERATING_HOURS,
  ROOM_SEAT_MAP_URLS,
  type LibrarySeason,
  type ReadingRoom,
} from "@/lib/library";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

function getUsageColor(percentage: number): string {
  if (percentage >= 66) return "bg-red-600"; // 2/3 이상
  if (percentage >= 33) return "bg-yellow-500"; // 1/3 이상
  return "bg-primary-600"; // 1/3 미만
}

export default function LibraryPage() {
  const [selectedSeason, setSelectedSeason] =
    useState<LibrarySeason>("semester");
  const [seatMapUrl, setSeatMapUrl] = useState<string | null>(null);

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
      }),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const currentHours = LIBRARY_OPERATING_HOURS[selectedSeason];
  const lastUpdatedTime = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("ko-KR")
    : "-";

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          도서관
        </h1>
        <p className="text-neutral-600">
          삼육대학교 중앙도서관 정보 및 열람실 현황
        </p>
      </div>

      {/* 열람실 현황 */}
      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-neutral-900">열람실 현황</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">
              마지막 업데이트: {lastUpdatedTime}
            </span>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="rounded bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isFetching ? "새로고침..." : "새로고침"}
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
                ? "열람실 정보를 불러올 수 없습니다. 잠시 후 다시 시도해주세요."
                : "표시할 열람실 좌석 정보가 없습니다."
            }
          />
        ) : (
          <div className="space-y-4">
            {rooms.map((room, idx) => {
              const usagePercent = Math.round(
                (room.strUseSeat / room.strTotalSeat) * 100,
              );
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
                          좌석보기
                        </button>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-neutral-700">
                      {room.strUseSeat}/{room.strTotalSeat}
                      <span className="text-neutral-500 ml-1">
                        ({usagePercent}%)
                      </span>
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
          <p>• 파란색: 1/3 미만</p>
          <p>• 주황색: 1/3 ~ 2/3</p>
          <p>• 빨간색: 2/3 이상</p>
        </div>
      </Card>

      {/* 운영시간 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-neutral-900">운영시간</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedSeason("semester")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedSeason === "semester"
                  ? "bg-primary-600 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              학기 중
            </button>
            <button
              onClick={() => setSelectedSeason("vacation")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedSeason === "vacation"
                  ? "bg-primary-600 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              방학 중
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
                        <span className="text-xs text-neutral-500">월-목</span>
                        <p className="font-medium text-neutral-900">
                          {room.schedule["월-목"]}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-neutral-500">금</span>
                        <p className="font-medium text-neutral-900">
                          {room.schedule["금"]}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-neutral-500">일</span>
                        <p className="font-medium text-neutral-900">
                          {room.schedule["일"] || "휴관"}
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

        {/* 주의사항 */}
        <Card className="mt-6 bg-neutral-50 border border-neutral-300">
          <h3 className="font-semibold text-neutral-900 mb-3">주의사항</h3>
          <ul className="text-sm text-neutral-700 space-y-1">
            <li>• 법정 공휴일, 토요일은 폐관합니다.</li>
            <li>• 스터디룸 이용 시 이용규정을 꼭 확인하시기 바랍니다.</li>
            <li>
              • 개관일정은 학술정보원 일정에 따라 변경될 수 있으니 공지사항을
              확인하시기 바랍니다.
            </li>
          </ul>
        </Card>
      </div>

      {/* 편의시설 및 서비스 */}
      <Card className="mb-6">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">
          편의시설 및 서비스
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">도서 대출/반납</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">학습 PC</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">학술 데이터베이스</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">인쇄/스캔</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">휴게실</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">화장실</span>
          </div>
        </div>
      </Card>

      {/* 이용 안내 */}
      <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200">
        <h2 className="text-lg font-bold text-blue-900 mb-4">이용 안내</h2>
        <div className="space-y-3 text-sm">
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">도서 대출</h3>
            <p className="text-blue-800">
              학생증 제시 후 도서 대출 (1인 5권, 14일)
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">열람실 이용</h3>
            <p className="text-blue-800">학생증 필수 / 개인 물품 관리 책임</p>
          </div>
        </div>
      </Card>

      {/* 좌석보기 모달 */}
      {seatMapUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl h-[80vh] animate-in fade-in duration-200 flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-neutral-200">
              <h3 className="text-lg font-bold text-neutral-900">좌석 현황</h3>
              <button
                onClick={() => setSeatMapUrl(null)}
                className="px-3 py-1.5 text-sm font-medium bg-neutral-200 text-neutral-900 rounded-lg hover:bg-neutral-300 transition-colors"
              >
                닫기
              </button>
            </div>
            <iframe
              src={seatMapUrl}
              className="flex-1 w-full border-0"
              title="좌석 현황"
            />
          </div>
        </div>
      )}
    </Container>
  );
}
