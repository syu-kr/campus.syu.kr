"use client";

import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { Skeleton } from "@/app/components/Skeleton";
import { useEffect, useState } from "react";

interface ReadingRoom {
  strRoomNm: string;
  strTotalSeat: number;
  strUseSeat: number;
  strRemainSeat: number;
}

function getUsageColor(percentage: number): string {
  if (percentage >= 66) return "bg-red-600"; // 2/3 이상
  if (percentage >= 33) return "bg-yellow-500"; // 1/3 이상
  return "bg-primary-600"; // 1/3 미만
}

export default function LibraryPage() {
  const [rooms, setRooms] = useState<ReadingRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  useEffect(() => {
    const fetchRoomStatus = async () => {
      try {
        const response = await fetch("/api/library/reading-rooms");
        const data = await response.json();
        setRooms(data);
        setLastUpdate(new Date().toLocaleTimeString("ko-KR"));
      } catch (error) {
        console.error("Failed to fetch room status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoomStatus();
    // 5분마다 갱신
    const interval = setInterval(fetchRoomStatus, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          도서관
        </h1>
        <p className="text-neutral-600">중앙도서관 정보</p>
      </div>

      <Card className="mb-6">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">운영시간</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">평일 (월~금)</span>
            <strong className="text-neutral-900">08:00 - 23:00</strong>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">토요일</span>
            <strong className="text-neutral-900">09:00 - 17:00</strong>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">일요일</span>
            <strong className="text-neutral-900">휴무</strong>
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-neutral-900">열람실 정보</h2>
          {lastUpdate && (
            <span className="text-xs text-neutral-500">
              마지막 업데이트: {lastUpdate}
            </span>
          )}
        </div>

        {isLoading ? (
          <Skeleton count={3} height="60px" />
        ) : rooms.length === 0 ? (
          <div className="py-4 text-center text-neutral-500">
            열람실 정보를 불러올 수 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {rooms.map((room, idx) => {
              const usagePercent = Math.round(
                (room.strUseSeat / room.strTotalSeat) * 100,
              );
              return (
                <div key={idx}>
                  <div className="flex justify-between items-center mb-2">
                    <strong className="text-neutral-900">
                      {room.strRoomNm}
                    </strong>
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
          <p>• 초록색: 1/3 미만</p>
          <p>• 주황색: 1/3 ~ 2/3</p>
          <p>• 빨간색: 2/3 이상</p>
        </div>
      </Card>
    </Container>
  );
}
