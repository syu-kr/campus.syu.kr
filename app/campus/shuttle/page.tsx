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

  // 현재 날짜/시간 정보
  const dateInfo = useMemo(() => {
    const now = new Date();
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
  }, []);

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

  // 30분 이내의 모든 버스들 (상단에 표시)
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
    const busesList: Array<{
      routeName: string;
      time: string;
      minutesUntil: number;
    }> = [];

    buses.forEach((bus) => {
      const times = bus.schedules[selectedType];
      times.forEach((time) => {
        const timeMinutes = timeToMinutes(time);
        const minutesUntil = timeMinutes - currentMinutes;

        if (minutesUntil > 0 && minutesUntil <= 30) {
          busesList.push({
            routeName: bus.routeName,
            time,
            minutesUntil,
          });
        }
      });
    });

    // 시간순으로 정렬
    busesList.sort((a, b) => a.minutesUntil - b.minutesUntil);
    return busesList;
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
        <Card className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400">
          <div className="mb-3">
            <p className="text-xs text-green-700 font-semibold mb-2">
              곧 오는 버스
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {nextBusesWithin30Min.map((bus, idx) => (
              <div
                key={idx}
                className="bg-white border-2 border-green-300 rounded-lg p-3"
              >
                <h3 className="text-base font-bold text-green-900 mb-1">
                  {bus.routeName}
                </h3>
                <div className="space-y-1">
                  <p className="text-sm text-green-800">
                    <strong>{bus.time}</strong> 출발
                  </p>
                  <p className="text-sm font-semibold text-green-600">
                    {bus.minutesUntil}분 후 도착
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
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
                        const isWithin30Min =
                          minutesUntil > 0 &&
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
