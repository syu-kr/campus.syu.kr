"use client";

import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { Skeleton } from "@/app/components/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { fetchShuttleBuses } from "@/lib/api";
import { useState, useMemo } from "react";

export default function ShuttlePage() {
  const { data: buses, isLoading } = useQuery({
    queryKey: ["shuttle-buses"],
    queryFn: () => fetchShuttleBuses(),
    staleTime: 5 * 60 * 1000,
  });

  const [selectedType, setSelectedType] = useState<
    | "mondayToThursday"
    | "friday"
    | "mondayToThursdayVacation"
    | "fridayVacation"
  >("mondayToThursday");

  // 현재 시간보다 늦은 첫 번째 버스 인덱스 계산
  const nextBusIndex = useMemo(() => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    return (times: string[]) => {
      return times.findIndex((time) => time >= currentTime);
    };
  }, []);

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          셔틀버스
        </h1>
        <p className="text-neutral-600">캠퍼스 셔틀버스 운행 시간표</p>
      </div>

      {/* 요일 선택 */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        <button
          onClick={() => setSelectedType("mondayToThursday")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
            selectedType === "mondayToThursday"
              ? "bg-primary-600 text-white"
              : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
          }`}
        >
          월요일-목요일
        </button>
        <button
          onClick={() => setSelectedType("friday")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
            selectedType === "friday"
              ? "bg-primary-600 text-white"
              : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
          }`}
        >
          금요일
        </button>
        <button
          onClick={() => setSelectedType("mondayToThursdayVacation")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
            selectedType === "mondayToThursdayVacation"
              ? "bg-primary-600 text-white"
              : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
          }`}
        >
          방학(월요일-목요일)
        </button>
        <button
          onClick={() => setSelectedType("fridayVacation")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
            selectedType === "fridayVacation"
              ? "bg-primary-600 text-white"
              : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
          }`}
        >
          방학(금요일)
        </button>
      </div>

      <div className="space-y-4">
        {isLoading && <Skeleton count={3} height="150px" />}

        {!isLoading &&
          buses &&
          buses.map((bus) => {
            const times = bus.schedules[selectedType];
            const upcomingIndex = nextBusIndex(times);

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
                        버스가 운행되지 않는 날입니다.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {times.map((time, idx) => (
                        <div
                          key={idx}
                          className={`rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
                            idx === upcomingIndex && upcomingIndex !== -1
                              ? "bg-red-100 border border-red-400 text-red-700 ring-2 ring-red-300"
                              : "bg-primary-50 border border-primary-200 text-primary-700"
                          }`}
                        >
                          {time}
                        </div>
                      ))}
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
          ℹ️ <strong>안내:</strong> 셔틀버스 시간은 변경될 수 있습니다.
        </p>
        <p className="text-xs text-blue-800">
          정확한 운행 시간은 캠퍼스 안내소에 문의하세요.
        </p>
      </Card>
    </Container>
  );
}
