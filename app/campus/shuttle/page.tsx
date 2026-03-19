"use client";

import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { Skeleton } from "@/app/components/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { fetchShuttleBuses } from "@/lib/api";
import { useState } from "react";

export default function ShuttlePage() {
  const { data: buses, isLoading } = useQuery({
    queryKey: ["shuttle-buses"],
    queryFn: () => fetchShuttleBuses(),
    staleTime: 5 * 60 * 1000,
  });

  const [selectedType, setSelectedType] = useState<"weekday" | "weekend">(
    "weekday",
  );

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          셔틀버스
        </h1>
        <p className="text-neutral-600">캠퍼스 셔틀버스 운행 시간표</p>
      </div>

      {/* 요일 선택 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setSelectedType("weekday")}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            selectedType === "weekday"
              ? "bg-primary-600 text-white"
              : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
          }`}
        >
          평일
        </button>
        <button
          onClick={() => setSelectedType("weekend")}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            selectedType === "weekend"
              ? "bg-primary-600 text-white"
              : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
          }`}
        >
          주말
        </button>
      </div>

      <div className="space-y-4">
        {isLoading && <Skeleton count={3} height="150px" />}

        {!isLoading &&
          buses &&
          buses.map((bus) => (
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {bus.schedules[selectedType].map((time, idx) => (
                    <div
                      key={idx}
                      className="bg-primary-50 border border-primary-200 rounded-lg px-3 py-2 text-center text-sm font-medium text-primary-700"
                    >
                      {time}
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-neutral-500 mt-3">
                최종 업데이트: {bus.lastUpdated}
              </p>
            </Card>
          ))}
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
