"use client";

import { Container } from "@/app/components/Container";

import { Card } from "@/app/components/Card";
import { LiveDataStatusBadge } from "@/app/components/LiveDataStatusBadge";
import { Skeleton } from "@/app/components/Skeleton";
import { useQuery } from "@tanstack/react-query";
import {
  fetchShuttleBuses,
  fetchBusLocationStatus,
  fetchShuttleSpecialPeriods,
} from "@/lib/api";
import { BusLocation, ShuttleBusSchedule, ShuttleScheduleType } from "@/types";
import {
  useState,
  useMemo,
  useEffect,
  useRef,
  type KeyboardEvent,
} from "react";
import {
  ShuttleMap,
  type ShuttleMapHandle,
} from "@/app/features/shuttle/ShuttleMap";
import {
  getShuttleScheduleType,
  isShuttleVacationDate,
} from "@/lib/shuttle-schedule";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import type { Locale } from "@/lib/i18n";
import type { LiveDataSourceStatus } from "@/types/live-data";

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
    period.applicableDates.length > 0
  ) {
    return period.applicableDates.includes(dateStr);
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

export default function ShuttleSection() {
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.pages.busInfo;

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
  const [locationError, setLocationError] = useState("");
  const [lastLocationUpdatedAt, setLastLocationUpdatedAt] =
    useState<Date | null>(null);
  const [isLocationStale, setIsLocationStale] = useState(false);
  const [locationSourceStatus, setLocationSourceStatus] =
    useState<LiveDataSourceStatus>("fresh");
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [isLocationPanelVisible, setIsLocationPanelVisible] = useState(false);
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

  const selectLiveBus = (busId: string) => {
    setSelectedBusId(busId);
    mapComponentRef.current?.openMarker(busId);
  };

  const handleLiveBusKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    busId: string,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    selectLiveBus(busId);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(interval);
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

    return {
      dayOfWeek,
      isWeekend,
      isFriday,
      currentTime,
      hour,
      minute,
      dayName: formatWeekday(now, locale),
      dateStr,
    };
  }, [locale, now]);

  const isVacationToday = useMemo(
    () => isShuttleVacationDate(dateInfo.dateStr, specialPeriods),
    [dateInfo.dateStr, specialPeriods],
  );
  const currentScheduleType = useMemo(
    () => (now ? getShuttleScheduleType(now, specialPeriods) : null),
    [now, specialPeriods],
  );

  // 초기 선택 상태 (현재 요일에 따라, 방학 기간 고려)
  const defaultType = useMemo(() => {
    if (isVacationToday) {
      return dateInfo.isFriday
        ? ("fridayVacation" as const)
        : ("mondayToThursdayVacation" as const);
    }

    if (dateInfo.isWeekend) return "mondayToThursday"; // 주말이면 월요일 시간표 표시
    if (dateInfo.isFriday) return "friday";
    return "mondayToThursday";
  }, [dateInfo.isFriday, dateInfo.isWeekend, isVacationToday]);

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
  const currentRegularScheduleType = dateInfo.isWeekend
    ? null
    : currentScheduleType;
  const dayButtons = [
    {
      type: "mondayToThursday" as const,
      label: text.semesterMonThu,
      isActive:
        !specialScheduleIsCurrent &&
        currentRegularScheduleType === "mondayToThursday"
          ? text.current
          : "",
    },
    {
      type: "friday" as const,
      label: text.semesterFri,
      isActive:
        !specialScheduleIsCurrent && currentRegularScheduleType === "friday"
          ? text.current
          : "",
    },
    {
      type: "mondayToThursdayVacation" as const,
      label: text.vacationMonThu,
      isActive:
        !specialScheduleIsCurrent &&
        currentRegularScheduleType === "mondayToThursdayVacation"
          ? text.current
          : "",
    },
    {
      type: "fridayVacation" as const,
      label: text.vacationFri,
      isActive:
        !specialScheduleIsCurrent &&
        currentRegularScheduleType === "fridayVacation"
          ? text.current
          : "",
    },
  ];
  const selectedRegularButton = dayButtons.find(
    (button) => button.type === selectedType,
  );
  const selectedButtonIsCurrent = useSpecialSchedule
    ? specialScheduleIsCurrent
    : Boolean(selectedRegularButton?.isActive);
  const selectedScheduleLabel = useSpecialSchedule
    ? text.specialSchedule
    : selectedRegularButton?.label || text.selectedSchedule;

  // defaultType 변경 시 selectedType도 자동으로 업데이트 (방학 기간 변경 대응)
  useEffect(() => {
    setSelectedType(defaultType);
  }, [defaultType]);

  useEffect(() => {
    setUseSpecialSchedule(hasReplacementSpecialSchedule);
  }, [hasReplacementSpecialSchedule]);

  useEffect(() => {
    setExpandedBuses(new Set());
  }, [selectedType, useSpecialSchedule]);

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

  // 버스 위치는 안내를 확인했고, 표시 가능한 시간일 때만 불러온다.
  useEffect(() => {
    if (
      !isLocationPanelVisible ||
      dateInfo.isWeekend ||
      !isWithinOperationHours
    ) {
      return;
    }

    let isActive = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const fetchLocations = async () => {
      try {
        const locationStatus = await fetchBusLocationStatus();
        if (!isActive) return;

        setBusLocations(locationStatus.data);
        setLastLocationUpdatedAt(new Date(locationStatus.timestamp));
        setIsLocationStale(locationStatus.stale);
        setLocationSourceStatus(locationStatus.sourceStatus);
        setLocationError("");
      } catch {
        if (!isActive) return;
        setLocationError(text.locationError);
        setLocationSourceStatus("error");
      }
    };

    const scheduleNextFetch = () => {
      const delay = Math.random() * 5000 + 5000;
      timeoutId = setTimeout(() => {
        fetchLocations();
        scheduleNextFetch();
      }, delay);
    };

    fetchLocations();
    scheduleNextFetch();

    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [
    dateInfo.isWeekend,
    isLocationPanelVisible,
    isWithinOperationHours,
    text.locationError,
  ]);

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          {text.shuttleTitle}
        </h1>
        <p className="text-neutral-600">
          {text.shuttleDescriptionPrefix} ({text.today}: {dateInfo.dayName}
          {text.weekdaySuffix})
        </p>
      </div>

      {dateInfo.isWeekend && (
        <Card
          className="mb-6 border border-amber-200 bg-amber-50/70"
          hover={false}
        >
          <p className="text-sm text-amber-900">
            <strong>{text.weekendNoticeTitle}</strong> {text.weekendNotice}
          </p>
        </Card>
      )}

      {!dateInfo.isWeekend &&
        isWithinOperationHours &&
        nextBusesWithin30Min.length > 0 && (
          <Card
            className="mb-6 border border-neutral-200 bg-white"
            hover={false}
          >
            <div className="mb-3">
              <p className="mb-2 text-xs font-semibold text-neutral-600 sm:text-sm">
                {text.upcomingBuses}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {nextBusesWithin30Min.map((bus, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 sm:p-4"
                >
                  <h3 className="mb-2 text-base font-bold text-neutral-900 sm:text-lg">
                    {bus.routeName}
                  </h3>
                  <div className="space-y-1">
                    <p className="text-sm text-neutral-700 sm:text-base">
                      <strong>{bus.time}</strong> {text.departs}
                    </p>
                    <p className="text-sm font-semibold text-primary-700 sm:text-base">
                      {bus.minutesUntil}
                      {locale === "ko" ? "" : " "}
                      {text.departsIn}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

      {!dateInfo.isWeekend && (
        <Card className="mb-6">
          <div className="mb-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-3 sm:gap-0">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900">
                {text.liveLocation}
              </h2>
              {isLocationPanelVisible && (
                <div className="flex flex-wrap gap-2 sm:gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: "#3b82f6" }}
                    ></div>
                    <span className="text-neutral-600">
                      {formatRouteBoundLabel("화랑대", locale)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: "#10b981" }}
                    ></div>
                    <span className="text-neutral-600">
                      {formatRouteBoundLabel("석계", locale)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: "#f59e0b" }}
                    ></div>
                    <span className="text-neutral-600">
                      {formatRouteBoundLabel("별내", locale)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: "#8b5cf6" }}
                    ></div>
                    <span className="text-neutral-600">
                      {formatRouteBoundLabel("구리", locale)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: "#d0d0d0" }}
                    ></div>
                    <span className="text-neutral-600">{text.campusBound}</span>
                  </div>
                </div>
              )}
            </div>
            {isLocationPanelVisible ? (
              <>
                <p className="text-xs sm:text-sm text-neutral-600">
                  {text.liveLocationDescription}
                  <br />
                  {text.autoUpdateLocation}
                </p>
                <LiveDataStatusBadge
                  locale={locale}
                  sourceLabel={dictionary.liveData.sources.shuttle}
                  timestamp={lastLocationUpdatedAt}
                  stale={isLocationStale}
                  sourceStatus={locationSourceStatus}
                  className="mt-2"
                />
                {(locationError || isLocationStale) && (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {locationError
                      ? `${locationError} ${text.staleLocationWarning}`
                      : text.staleLocationWarning}
                  </p>
                )}
              </>
            ) : !isWithinOperationHours ? (
              <p className="text-xs sm:text-sm text-neutral-600">
                {text.outsideOperation}
              </p>
            ) : (
              <p className="text-xs sm:text-sm text-neutral-600">
                {text.locationDisclosureHint}
              </p>
            )}
          </div>

          {!isWithinOperationHours ? (
            <ShuttleLocationState
              title={text.locationUnavailableTitle}
              message={text.locationUnavailableMessage}
            />
          ) : !isLocationPanelVisible ? (
            <ShuttleLocationDisclosure
              onConfirm={() => setIsLocationPanelVisible(true)}
            />
          ) : busLocations.length > 0 ? (
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
                      4: "구리",
                    };
                    const statusLabels: Record<number, string> = {
                      1: text.schoolToStation,
                      2: text.stationToSchool,
                    };
                    const routeColors: Record<string | number, string> = {
                      1: "bg-blue-100 text-blue-700",
                      2: "bg-green-100 text-green-700",
                      3: "bg-amber-100 text-amber-700",
                      4: "bg-violet-100 text-violet-700",
                    };

                    // status가 1일 때만 routeid 색 사용, status가 2일 때는 회색
                    const bgColor =
                      bus.status === 1
                        ? routeColors[bus.routeid] || "bg-gray-100"
                        : "bg-gray-100 text-gray-600";

                    return (
                      <div
                        key={bus.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${routeNames[bus.routeid]} ${statusLabels[bus.status] || text.unknown}`}
                        onClick={() => selectLiveBus(bus.id)}
                        onKeyDown={(event) =>
                          handleLiveBusKeyDown(event, bus.id)
                        }
                        className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg p-3 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:p-4 ${bgColor}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm sm:text-base truncate">
                            {routeNames[bus.routeid]}
                          </p>
                        </div>
                        <span className="text-xs sm:text-sm font-medium whitespace-nowrap flex-shrink-0">
                          {statusLabels[bus.status] || text.unknown}
                        </span>
                      </div>
                    );
                  })}
              </div>

              <ShuttleMap
                ref={mapComponentRef}
                busLocations={busLocations}
                selectedBusId={selectedBusId}
                labels={{
                  status: text.status,
                  schoolToStation: text.schoolToStation,
                  stationToSchool: text.stationToSchool,
                  unknown: text.unknown,
                }}
              />
            </>
          ) : (
            <ShuttleLocationState
              title={text.locationEmptyTitle}
              message={text.locationEmptyMessage}
            />
          )}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2 mb-6 sm:grid-cols-3">
        {dayButtons.map((btn) => (
          <button
            key={btn.type}
            type="button"
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
            {text.specialSchedule}
            {specialScheduleIsCurrent && (
              <span className="ml-1 text-xs bg-purple-700 text-white px-2 py-0.5 rounded-full">
                {text.current}
              </span>
            )}
          </button>
        )}
      </div>

      <Card
        id="shuttle-schedules"
        className="mb-4 border border-neutral-200 bg-neutral-50"
        hover={false}
      >
        <p className="text-sm font-semibold text-neutral-900">
          {text.scheduleBase}: {selectedScheduleLabel}
        </p>
        <p className="mt-1 text-xs leading-5 text-neutral-600">
          {text.scheduleNotice}
        </p>
      </Card>

      {activeSpecialPeriods.length > 0 && (
        <Card
          className="mb-4 border border-purple-200 bg-purple-50/70 text-sm text-purple-900"
          hover={false}
        >
          <p className="font-bold mb-2">{text.specialPeriodTitle}</p>
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
        <Card
          className="mb-4 border border-amber-200 bg-amber-50/70 text-sm text-amber-900"
          hover={false}
        >
          <p>{text.vacationNotice}</p>
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
                  {text.noBusInfo}
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
            const isExpanded = expandedBuses.has(bus.id);
            const routeStops = Array.isArray(bus.stops) ? bus.stops : [];

            return (
              <Card key={bus.id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleBusExpand(bus.id)}
                  className="w-full rounded-lg px-1 py-1 text-left transition-all duration-200 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  aria-expanded={isExpanded}
                  aria-label={`${bus.routeName} ${text.scheduleToggleLabel} ${
                    isExpanded ? text.collapse : text.expand
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 p-3">
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-neutral-900 mb-1">
                        {bus.routeName}
                      </h2>
                      {routeStops.length > 0 ? (
                        <>
                          <p className="text-sm text-neutral-600">
                            {text.routeLoop}
                          </p>
                          <ol className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-neutral-600">
                            {routeStops.map((stop, stopIndex) => (
                              <li
                                key={`${bus.id}-${stop}-${stopIndex}`}
                                className="flex items-center gap-1.5"
                              >
                                <span className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 leading-4">
                                  {stop}
                                </span>
                                {stopIndex < routeStops.length - 1 && (
                                  <span
                                    className="text-neutral-400"
                                    aria-hidden="true"
                                  >
                                    →
                                  </span>
                                )}
                              </li>
                            ))}
                          </ol>
                        </>
                      ) : (
                        <p className="text-sm text-neutral-600">
                          {bus.startLocation} → {bus.endLocation}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 bg-primary-50 rounded-lg">
                      <svg
                        className={`w-5 h-5 text-primary-600 transition-transform duration-300 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        focusable="false"
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

                {isExpanded && (
                  <div className="border-t border-neutral-200 pt-4 mt-4 animate-in fade-in duration-200">
                    <p className="text-xs text-neutral-500 font-semibold mb-3 uppercase tracking-wide">
                      {text.operationTime}
                    </p>
                    {times.length === 0 ? (
                      <div className="bg-neutral-100 border border-neutral-300 rounded-lg px-4 py-6 text-center">
                        <p className="text-sm text-neutral-600 font-medium">
                          {text.noServiceOnDate}
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
                      {text.lastUpdated}: {bus.lastUpdated}
                    </p>
                  </div>
                )}
              </Card>
            );
          })}
      </div>
    </Container>
  );
}

function ShuttleLocationDisclosure({ onConfirm }: { onConfirm: () => void }) {
  const text = useDictionary().pages.busInfo;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-5">
      <p className="font-semibold text-amber-950">
        {text.locationDisclosureTitle}
      </p>
      <p className="mt-2 break-keep text-sm leading-6 text-amber-900">
        {text.locationDisclosureMessage}
      </p>
      <button
        type="button"
        onClick={onConfirm}
        className="mt-4 inline-flex rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-700 focus:ring-offset-2"
      >
        {text.locationDisclosureAction}
      </button>
    </div>
  );
}

function ShuttleLocationState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center">
      <p className="font-semibold text-neutral-900">{title}</p>
      <p className="mx-auto mt-2 w-full max-w-[18rem] whitespace-pre-line break-keep text-sm leading-6 text-neutral-600 sm:max-w-md">
        {message}
      </p>
    </div>
  );
}

function getLocaleCode(locale: Locale) {
  return locale === "ko" ? "ko-KR" : "en-US";
}

function formatWeekday(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(getLocaleCode(locale), {
    weekday: "short",
  }).format(date);
}

function formatRouteBoundLabel(routeName: string, locale: Locale) {
  return locale === "ko" ? `${routeName}행` : `${routeName} bound`;
}
