"use client";

import { Container } from "@/app/components/Container";

import { Card } from "@/app/components/Card";
import { Skeleton } from "@/app/components/Skeleton";
import { useQuery } from "@tanstack/react-query";
import {
  fetchShuttleBuses,
  fetchBusLocations,
  fetchShuttleSpecialPeriods,
} from "@/lib/api";
import { BusLocation, ShuttleBusSchedule, ShuttleScheduleType } from "@/types";
import {
  useState,
  useMemo,
  useEffect,
  useRef,
} from "react";
import {
  ShuttleMap,
  type ShuttleMapHandle,
} from "@/app/features/shuttle/ShuttleMap";

const ONE_MINUTE = 60 * 1000;
const FIVE_MINUTES = 5 * ONE_MINUTE;
const SCHEDULE_TYPES: ShuttleScheduleType[] = [
  "mondayToThursday",
  "friday",
  "mondayToThursdayVacation",
  "fridayVacation",
];

function createScheduleCopy(
  schedules: ShuttleBusSchedule["schedules"] | undefined,
): ShuttleBusSchedule["schedules"] {
  return {
    mondayToThursday: Array.isArray(schedules?.mondayToThursday)
      ? [...schedules.mondayToThursday]
      : [],
    friday: Array.isArray(schedules?.friday) ? [...schedules.friday] : [],
    mondayToThursdayVacation: Array.isArray(schedules?.mondayToThursdayVacation)
      ? [...schedules.mondayToThursdayVacation]
      : [],
    fridayVacation: Array.isArray(schedules?.fridayVacation)
      ? [...schedules.fridayVacation]
      : [],
  };
}

function isDateInSpecialPeriod(
  period: { applicableDates?: string[]; startDate?: string; endDate?: string },
  dateStr: string,
): boolean {
  if (
    Array.isArray(period.applicableDates) &&
    period.applicableDates.includes(dateStr)
  ) {
    return true;
  }

  if (period.startDate && period.endDate) {
    return dateStr >= period.startDate && dateStr <= period.endDate;
  }

  return false;
}

function isReplacementSpecialPeriod(period: {
  type?: string;
  replacementSchedules?: unknown;
}): boolean {
  return period.type === "replace" || Boolean(period.replacementSchedules);
}

export default function ShuttlePage() {
  const { data: buses, isLoading } = useQuery({
    queryKey: ["shuttle-buses"],
    queryFn: () => fetchShuttleBuses(),
    staleTime: FIVE_MINUTES,
    gcTime: 30 * ONE_MINUTE,
  });

  const { data: specialPeriods } = useQuery({
    queryKey: ["shuttle-special-periods"],
    queryFn: () => fetchShuttleSpecialPeriods(),
    staleTime: FIVE_MINUTES,
    gcTime: 30 * ONE_MINUTE,
  });

  // 현재 시간을 매초 업데이트
  const [now, setNow] = useState(new Date());
  const [busLocations, setBusLocations] = useState<BusLocation[]>([]);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [expandedBuses, setExpandedBuses] = useState<Set<string>>(new Set());
  const mapComponentRef = useRef<ShuttleMapHandle | null>(null);

  const toggleBusExpand = (busId: string) => {
    setExpandedBuses((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(busId)) {
        newSet.delete(busId);
      } else {
        newSet.add(busId);
      }
      return newSet;
    });
  };

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
        setBusLocations(locations);
      } catch {
        // Silently handle errors
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

    // 현재 날짜를 YYYY-MM-DD 형식으로
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const date = String(now.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${date}`;

    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

    return {
      dayOfWeek,
      isWeekend,
      isFriday,
      currentTime,
      hour,
      minute,
      dayName: dayNames[dayOfWeek],
      dateStr,
    };
  }, [now]);

  // 초기 선택 상태 (현재 요일에 따라, 방학 기간 고려)
  const defaultType = useMemo(() => {
    const vacationPeriods = Array.isArray(specialPeriods?.vacationPeriods)
      ? specialPeriods.vacationPeriods
      : [];

    // 방학 기간 확인
    for (const vacation of vacationPeriods) {
      if (
        dateInfo.dateStr >= vacation.startDate &&
        dateInfo.dateStr <= vacation.endDate
      ) {
        // 방학 기간 내: 금요일 판별
        if (dateInfo.isFriday) {
          return "fridayVacation" as const;
        }
        return "mondayToThursdayVacation" as const;
      }
    }

    // 학기 중
    if (dateInfo.isWeekend) return "mondayToThursday"; // 주말이면 월요일 시간표 표시
    if (dateInfo.isFriday) return "friday";
    return "mondayToThursday";
  }, [dateInfo, specialPeriods?.vacationPeriods]);

  const [selectedType, setSelectedType] = useState<
    | "mondayToThursday"
    | "friday"
    | "mondayToThursdayVacation"
    | "fridayVacation"
  >(defaultType);
  const [useSpecialSchedule, setUseSpecialSchedule] = useState(false);

  const activeSpecialPeriods = useMemo(
    () =>
      Array.isArray(specialPeriods?.specialPeriods)
        ? specialPeriods.specialPeriods.filter(
            (period) =>
              Array.isArray(period.applicableDates) &&
              period.applicableDates.includes(dateInfo.dateStr),
          )
        : [],
    [dateInfo.dateStr, specialPeriods?.specialPeriods],
  );
  const activeReplacementSpecialPeriods = activeSpecialPeriods.filter(
    (period) => isReplacementSpecialPeriod(period),
  );
  const hasReplacementSpecialSchedule =
    activeReplacementSpecialPeriods.length > 0;
  const specialScheduleIsCurrent = activeReplacementSpecialPeriods.length > 0;
  const dayButtons = [
    {
      type: "mondayToThursday" as const,
      label: "학기(월-목)",
      isActive:
        !specialScheduleIsCurrent && !dateInfo.isWeekend && !dateInfo.isFriday
          ? "현재"
          : "",
    },
    {
      type: "friday" as const,
      label: "학기(금)",
      isActive: !specialScheduleIsCurrent && dateInfo.isFriday ? "현재" : "",
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
  const selectedRegularButton = dayButtons.find(
    (button) => button.type === selectedType,
  );
  const selectedButtonIsCurrent = useSpecialSchedule
    ? specialScheduleIsCurrent
    : Boolean(selectedRegularButton?.isActive);
  // defaultType 변경 시 selectedType도 자동으로 업데이트 (방학 기간 변경 대응)
  useEffect(() => {
    setSelectedType(defaultType);
  }, [defaultType]);

  useEffect(() => {
    setUseSpecialSchedule(hasReplacementSpecialSchedule);
  }, [hasReplacementSpecialSchedule]);

  // 특수 기간 추가 시간을 병합한 버스 데이터
  const busesWithSpecialPeriods = useMemo((): ShuttleBusSchedule[] => {
    // 시간 정렬 헬퍼 함수 (useMemo 내부에서 사용)
    const parseTime = (timeStr: string): number => {
      if (!timeStr || typeof timeStr !== "string") return 0;
      const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
      if (!match) return 0;
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      if (isNaN(hours) || isNaN(minutes)) return 0;
      return hours * 60 + minutes;
    };

    const busList = Array.isArray(buses) ? buses.filter(Boolean) : [];
    const normalizedBusList = busList.map((bus) => ({
      ...bus,
      schedules: createScheduleCopy(bus.schedules),
    }));
    const periodList = Array.isArray(specialPeriods?.specialPeriods)
      ? specialPeriods.specialPeriods
      : [];

    if (normalizedBusList.length === 0) return [];
    if (periodList.length === 0) return normalizedBusList;

    // 현재 날짜의 추가 운행과, 버튼으로 선택한 대체 시간표를 분리 적용한다.
    const activeAddPeriods = periodList.filter(
      (period) =>
        isDateInSpecialPeriod(period, dateInfo.dateStr) &&
        !isReplacementSpecialPeriod(period),
    );
    const replacementPeriodsToApply = useSpecialSchedule
      ? activeReplacementSpecialPeriods
      : [];
    const applicableSpecialPeriods = [
      ...activeAddPeriods,
      ...replacementPeriodsToApply,
    ];

    if (applicableSpecialPeriods.length === 0) {
      return normalizedBusList;
    }

    // 버스 데이터 복사하여 특수 기간 시간표 적용
    return normalizedBusList.map((bus) => {
      const schedulesCopy = createScheduleCopy(bus.schedules);

      // 이 버스에 적용될 특수 기간 필터링
      const applicablePeriodsForBus = applicableSpecialPeriods.filter(
        (period) => {
          // routes에 "all"이 있거나, 이 버스 ID가 포함된 경우
          const routes = Array.isArray(period.routes) ? period.routes : [];
          return routes.includes("all") || routes.includes(bus.id);
        },
      );

      if (applicablePeriodsForBus.length === 0) {
        return bus; // 적용될 특수 기간이 없으면 원본 반환
      }

      applicablePeriodsForBus
        .filter(
          (period) => useSpecialSchedule && isReplacementSpecialPeriod(period),
        )
        .forEach((period) => {
          const replacement = period.replacementSchedules?.[bus.id];
          if (!replacement) return;

          SCHEDULE_TYPES.forEach((scheduleType) => {
            const replacementTimes = Array.isArray(replacement)
              ? replacement
              : replacement[scheduleType];

            if (Array.isArray(replacementTimes)) {
              schedulesCopy[scheduleType] = [...replacementTimes].sort(
                (a, b) => parseTime(a) - parseTime(b),
              );
            }
          });
        });

      // 이 버스에 추가할 시간 수집
      const addedTimes = new Set<string>();
      applicablePeriodsForBus
        .filter((period) => (period.type ?? "add") !== "replace")
        .forEach((period) => {
          const periodAddedTimes = Array.isArray(period.addedTimes)
            ? period.addedTimes
            : [];
          periodAddedTimes.forEach((time) => addedTimes.add(time));
        });

      // 각 시간표 타입에 추가 시간 병합 (정렬)
      SCHEDULE_TYPES.forEach((key) => {
        const times = schedulesCopy[key];
        if (Array.isArray(times)) {
          const mergedTimes = Array.from(new Set([...times, ...addedTimes]));
          mergedTimes.sort((a, b) => {
            const aMinutes = parseTime(a);
            const bMinutes = parseTime(b);
            return aMinutes - bMinutes;
          });
          schedulesCopy[key] = mergedTimes;
        }
      });

      return { ...bus, schedules: schedulesCopy };
    });
  }, [
    activeReplacementSpecialPeriods,
    buses,
    dateInfo.dateStr,
    specialPeriods?.specialPeriods,
    useSpecialSchedule,
  ]);

  // 시간 문자열을 분 단위로 변환 (공백, 형식 오류 처리)
  const timeToMinutes = (timeStr: string): number => {
    // 입력값 유효성 검사
    if (!timeStr || typeof timeStr !== "string") {
      console.warn("Invalid timeStr:", timeStr);
      return 0;
    }

    // 공백 제거 및 정규화
    const normalized = timeStr.trim();

    // 시간:분 형식 검증
    const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      console.warn("Invalid time format:", timeStr);
      return 0;
    }

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);

    // 시간, 분 범위 검증
    if (
      isNaN(hours) ||
      isNaN(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      console.warn("Out of range time values:", { timeStr, hours, minutes });
      return 0;
    }

    return hours * 60 + minutes;
  };

  // 노선별 가장 빨리 출발하는 버스 (30분 이내인 경우만)
  const nextBusesWithin30Min = useMemo((): Array<{
    routeName: string;
    time: string;
    minutesUntil: number;
  }> => {
    if (
      !busesWithSpecialPeriods ||
      busesWithSpecialPeriods.length === 0 ||
      dateInfo.isWeekend ||
      !selectedButtonIsCurrent
    )
      return [];

    const currentMinutes = dateInfo.hour * 60 + dateInfo.minute;
    const busesByRoute = new Map<
      string,
      { time: string; minutesUntil: number }
    >();

    // 각 노선별로 첫 번째 버스(가장 빨리 출발)를 찾기
    busesWithSpecialPeriods.forEach((bus) => {
      const times = Array.isArray(bus.schedules?.[selectedType])
        ? bus.schedules[selectedType]
        : [];

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
  }, [
    busesWithSpecialPeriods,
    dateInfo,
    selectedButtonIsCurrent,
    selectedType,
  ]);

  // 노선별 가장 빨리 오는 버스 시간 (하이라이트용)
  const nextBusTimeByRoute = useMemo((): Map<string, string> => {
    if (
      !busesWithSpecialPeriods ||
      busesWithSpecialPeriods.length === 0 ||
      dateInfo.isWeekend ||
      !selectedButtonIsCurrent
    )
      return new Map();

    const currentMinutes = dateInfo.hour * 60 + dateInfo.minute;
    const timeByRoute = new Map<string, string>();

    busesWithSpecialPeriods.forEach((bus) => {
      const times = Array.isArray(bus.schedules?.[selectedType])
        ? bus.schedules[selectedType]
        : [];

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
  }, [
    busesWithSpecialPeriods,
    dateInfo,
    selectedButtonIsCurrent,
    selectedType,
  ]);

  // 현재 시간이 운영 시간 내인지 확인 (버스 데이터 기반)
  const isWithinOperationHours = useMemo(() => {
    if (
      !busesWithSpecialPeriods ||
      busesWithSpecialPeriods.length === 0 ||
      !now
    )
      return false;

    const currentMinutes = dateInfo.hour * 60 + dateInfo.minute;
    let firstTime = Infinity;
    let lastTime = -Infinity;

    // 현재 요일의 모든 버스 시간에서 첫차와 마지막차 찾기
    busesWithSpecialPeriods.forEach((bus) => {
      const times = Array.isArray(bus.schedules?.[selectedType])
        ? bus.schedules[selectedType]
        : [];
      if (times.length > 0) {
        times.forEach((time) => {
          const timeMinutes = timeToMinutes(time);
          firstTime = Math.min(firstTime, timeMinutes);
          lastTime = Math.max(lastTime, timeMinutes);
        });
      }
    });

    if (firstTime === Infinity || lastTime === -Infinity) {
      return false;
    }

    // 첫차 30분 전부터 마지막차 30분 후까지
    const operationStart = Math.max(0, firstTime - 30);
    const operationEnd = Math.min(24 * 60 - 1, lastTime + 30);

    return currentMinutes >= operationStart && currentMinutes <= operationEnd;
  }, [busesWithSpecialPeriods, dateInfo, now, selectedType]);

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

      {dateInfo.isWeekend && (
        <Card className="mb-6 bg-orange-50 border border-orange-300">
          <p className="text-sm text-orange-900">
            <strong>안내:</strong> 오늘은 주말입니다. 셔틀버스가 운행되지
            않습니다.
          </p>
        </Card>
      )}

      {!dateInfo.isWeekend &&
        isWithinOperationHours &&
        nextBusesWithin30Min.length > 0 && (
          <Card className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50">
            <div className="mb-3">
              <p className="text-xs sm:text-sm text-green-700 font-semibold mb-2">
                곧 출발하는 버스
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {nextBusesWithin30Min.map((bus, idx) => (
                <div key={idx} className="bg-white rounded-lg p-3 sm:p-4">
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
        )}

      {!dateInfo.isWeekend && isWithinOperationHours && (
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

          {busLocations.length > 0 ? (
            <>
              <div
                id="shuttle-map"
                className="w-full h-80 sm:h-96 md:h-[500px] rounded-lg border border-neutral-200 overflow-hidden mb-4"
                style={{ minHeight: "320px" }}
              />

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
                      2: "역 → 학교",
                    };
                    const routeColors: Record<string | number, string> = {
                      1: "bg-blue-100 text-blue-700",
                      2: "bg-green-100 text-green-700",
                      3: "bg-amber-100 text-amber-700",
                    };

                    // status가 1일 때만 routeid 색 사용, status가 2일 때는 회색
                    const bgColor =
                      bus.status === 1
                        ? routeColors[bus.routeid] || "bg-gray-100"
                        : "bg-gray-100 text-gray-600";

                    return (
                      <div
                        key={bus.id}
                        onClick={() => {
                          setSelectedBusId(bus.id);
                          mapComponentRef.current?.openMarker(bus.id);
                        }}
                        className={`p-3 sm:p-4 rounded-lg flex justify-between items-center gap-3 cursor-pointer transition-all hover:shadow-md ${bgColor}`}
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

              <ShuttleMap
                ref={mapComponentRef}
                busLocations={busLocations}
                selectedBusId={selectedBusId}
              />
            </>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-neutral-700 mb-3 font-medium">
                현재 실시간 버스 위치 정보가 없습니다.
              </p>
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2 mb-6 sm:grid-cols-3">
        {dayButtons.map((btn) => (
          <button
            key={btn.type}
            onClick={() => {
              setSelectedType(btn.type);
              setUseSpecialSchedule(false);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
              selectedType === btn.type && !useSpecialSchedule
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
        {hasReplacementSpecialSchedule && (
          <button
            type="button"
            onClick={() => {
              setSelectedType(defaultType);
              setUseSpecialSchedule(true);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
              useSpecialSchedule
                ? "bg-purple-600 text-white"
                : "bg-purple-50 text-purple-800 hover:bg-purple-100"
            }`}
          >
            특별운행
            {specialScheduleIsCurrent && (
              <span className="ml-1 text-xs bg-purple-700 text-white px-2 py-0.5 rounded-full">
                현재
              </span>
            )}
          </button>
        )}
      </div>

      {activeSpecialPeriods.length > 0 && (
        <Card className="mb-4 bg-purple-50 border-2 border-purple-300 text-sm text-purple-900">
          <p className="font-bold mb-2">셔틀버스 특수 운행 기간입니다</p>
          <ul className="list-disc list-inside space-y-1">
            {activeSpecialPeriods.map((period) => (
              <li key={period.id} className="text-purple-800">
                {period.name}: {period.description}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(selectedType === "mondayToThursdayVacation" ||
        selectedType === "fridayVacation") && (
        <Card className="mb-4 bg-yellow-50 border border-yellow-200 text-sm text-yellow-900">
          <p>방학 중 시간표입니다. 운행 시간이 다를 수 있습니다.</p>
        </Card>
      )}

      <div className="space-y-4">
        {isLoading && <Skeleton count={3} height="150px" />}

        {!isLoading &&
          busesWithSpecialPeriods &&
          busesWithSpecialPeriods.length === 0 && (
            <Card>
              <div className="py-8 text-center">
                <p className="text-neutral-600">
                  버스 정보를 불러올 수 없습니다.
                </p>
              </div>
            </Card>
          )}

        {!isLoading &&
          busesWithSpecialPeriods &&
          busesWithSpecialPeriods.map((bus) => {
            const times = Array.isArray(bus.schedules?.[selectedType])
              ? bus.schedules[selectedType]
              : [];

            return (
              <Card key={bus.id} className="overflow-hidden">
                <button
                  onClick={() => toggleBusExpand(bus.id)}
                  className="w-full text-left hover:bg-neutral-50 px-1 py-1 rounded-lg transition-all duration-200"
                  aria-label="시간표 펼치기"
                >
                  <div className="flex items-center justify-between gap-3 p-3">
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-neutral-900 mb-1">
                        {bus.routeName}
                      </h2>
                      <p className="text-sm text-neutral-600">
                        {bus.startLocation} → {bus.endLocation}
                      </p>
                    </div>
                    <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 bg-primary-50 rounded-lg">
                      <svg
                        className={`w-5 h-5 text-primary-600 transition-transform duration-300 ${
                          expandedBuses.has(bus.id) ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M19 14l-7 7m0 0l-7-7m7 7V3"
                        />
                      </svg>
                    </div>
                  </div>
                </button>

                {expandedBuses.has(bus.id) && (
                  <div className="border-t border-neutral-200 pt-4 mt-4 animate-in fade-in duration-200">
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
                        {times
                          .filter((time) => {
                            // 유효한 시간 형식만 필터링
                            if (!time || typeof time !== "string") return false;
                            const match = time
                              .trim()
                              .match(/^(\d{1,2}):(\d{2})$/);
                            return match !== null;
                          })
                          .map((time, idx) => {
                            const timeMinutes = timeToMinutes(time);
                            const currentMinutes =
                              dateInfo.hour * 60 + dateInfo.minute;
                            const minutesUntil = timeMinutes - currentMinutes;

                            // timeMinutes가 유효한지 확인
                            if (isNaN(timeMinutes)) {
                              console.error("NaN timeMinutes for time:", time);
                              return null; // NaN이면 렌더링하지 않음
                            }

                            // 이 노선의 가장 빨리 오는 버스인지 확인
                            const nextBusTime = nextBusTimeByRoute.get(
                              bus.routeName,
                            );
                            const isNextBus = nextBusTime === time;
                            const isWithin30Min =
                              isNextBus &&
                              minutesUntil <= 30 &&
                              selectedButtonIsCurrent &&
                              !dateInfo.isWeekend;
                            const isPassedTime =
                              minutesUntil < 0 &&
                              selectedButtonIsCurrent &&
                              !dateInfo.isWeekend;
                            const timeChipClass = isPassedTime
                              ? "bg-gray-100 border border-gray-300 text-gray-500"
                              : isWithin30Min
                              ? "bg-green-100 border-2 border-green-500 text-green-700 font-bold"
                              : "bg-primary-50 border border-primary-200 text-primary-700";

                            return (
                              <div
                                key={idx}
                                className={`rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${timeChipClass}`}
                              >
                                {time}
                              </div>
                            );
                          })
                          .filter(Boolean)}{" "}
                      </div>
                    )}

                    <p className="text-xs text-neutral-500 mt-3">
                      최종 업데이트: {bus.lastUpdated}
                    </p>
                  </div>
                )}
              </Card>
            );
          })}
      </div>

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

