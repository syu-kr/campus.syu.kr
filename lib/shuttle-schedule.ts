import type {
  ShuttleBusSchedule,
  ShuttleScheduleType,
  ShuttleSpecialPeriod,
  ShuttleSpecialPeriods,
} from "@/types";

const SCHEDULE_TYPES: ShuttleScheduleType[] = [
  "mondayToThursday",
  "friday",
  "mondayToThursdayVacation",
  "fridayVacation",
];

export interface NextShuttleDeparture {
  routeName: string;
  time: string;
  minutesUntil: number;
}

export interface CurrentShuttleSummary {
  departures: NextShuttleDeparture[];
  isWeekend: boolean;
  isSpecialSchedule: boolean;
  scheduleLabel: string;
  hasMoreToday: boolean;
}

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

function timeToMinutes(time: string): number | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
}

function isReplacementSpecialPeriod(period: ShuttleSpecialPeriod): boolean {
  return period.type === "replace" || Boolean(period.replacementSchedules);
}

function isDateInSpecialPeriod(
  period: Pick<
    ShuttleSpecialPeriod,
    "applicableDates" | "startDate" | "endDate"
  >,
  dateString: string,
): boolean {
  if (period.applicableDates.includes(dateString)) return true;
  return dateString >= period.startDate && dateString <= period.endDate;
}

function getDateInfo(now: Date) {
  const dayOfWeek = now.getDay();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");

  return {
    currentMinutes: now.getHours() * 60 + now.getMinutes(),
    dateString: `${year}-${month}-${date}`,
    isFriday: dayOfWeek === 5,
    isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
  };
}

function getScheduleType(
  now: Date,
  specialPeriods?: ShuttleSpecialPeriods,
): ShuttleScheduleType {
  const dateInfo = getDateInfo(now);
  const vacationPeriods = Array.isArray(specialPeriods?.vacationPeriods)
    ? specialPeriods.vacationPeriods
    : [];

  const isVacation = vacationPeriods.some(
    (period) =>
      dateInfo.dateString >= period.startDate &&
      dateInfo.dateString <= period.endDate,
  );

  if (isVacation) {
    return dateInfo.isFriday ? "fridayVacation" : "mondayToThursdayVacation";
  }

  return dateInfo.isFriday ? "friday" : "mondayToThursday";
}

function getScheduleLabel(type: ShuttleScheduleType, isSpecial: boolean) {
  if (isSpecial) return "특별운행";
  if (type === "friday") return "학기 금요일";
  if (type === "mondayToThursdayVacation") return "방학 월-목";
  if (type === "fridayVacation") return "방학 금요일";
  return "학기 월-목";
}

function applySpecialPeriods({
  buses,
  dateString,
  specialPeriods,
}: {
  buses: ShuttleBusSchedule[];
  dateString: string;
  specialPeriods?: ShuttleSpecialPeriods;
}) {
  const normalizedBuses = buses.map((bus) => ({
    ...bus,
    schedules: createScheduleCopy(bus.schedules),
  }));
  const periods = Array.isArray(specialPeriods?.specialPeriods)
    ? specialPeriods.specialPeriods
    : [];
  const activePeriods = periods.filter((period) =>
    isDateInSpecialPeriod(period, dateString),
  );
  const activeReplacementPeriods = activePeriods.filter(
    isReplacementSpecialPeriod,
  );
  const useReplacementSchedule = activeReplacementPeriods.length > 0;
  const applicablePeriods = [
    ...activePeriods.filter((period) => !isReplacementSpecialPeriod(period)),
    ...activeReplacementPeriods,
  ];

  if (applicablePeriods.length === 0) {
    return {
      buses: normalizedBuses,
      isSpecialSchedule: false,
    };
  }

  return {
    buses: normalizedBuses.map((bus) => {
      const schedules = createScheduleCopy(bus.schedules);
      const periodsForBus = applicablePeriods.filter((period) => {
        const routes = Array.isArray(period.routes) ? period.routes : [];
        return routes.includes("all") || routes.includes(bus.id);
      });

      periodsForBus
        .filter(isReplacementSpecialPeriod)
        .forEach((period) => {
          const replacement = period.replacementSchedules?.[bus.id];
          if (!replacement) return;

          SCHEDULE_TYPES.forEach((scheduleType) => {
            const replacementTimes = Array.isArray(replacement)
              ? replacement
              : replacement[scheduleType];

            if (Array.isArray(replacementTimes)) {
              schedules[scheduleType] = [...replacementTimes].sort(
                (a, b) => (timeToMinutes(a) ?? 0) - (timeToMinutes(b) ?? 0),
              );
            }
          });
        });

      const addedTimes = new Set<string>();
      periodsForBus
        .filter((period) => (period.type ?? "add") !== "replace")
        .forEach((period) => {
          period.addedTimes?.forEach((time) => addedTimes.add(time));
        });

      if (addedTimes.size > 0) {
        SCHEDULE_TYPES.forEach((scheduleType) => {
          schedules[scheduleType] = Array.from(
            new Set([...schedules[scheduleType], ...addedTimes]),
          ).sort((a, b) => (timeToMinutes(a) ?? 0) - (timeToMinutes(b) ?? 0));
        });
      }

      return { ...bus, schedules };
    }),
    isSpecialSchedule: useReplacementSchedule,
  };
}

export function getCurrentShuttleSummary({
  buses,
  specialPeriods,
  now,
  limit = 3,
}: {
  buses?: ShuttleBusSchedule[];
  specialPeriods?: ShuttleSpecialPeriods;
  now: Date | null;
  limit?: number;
}): CurrentShuttleSummary {
  if (!now) {
    return {
      departures: [],
      isWeekend: false,
      isSpecialSchedule: false,
      scheduleLabel: "오늘 시간표",
      hasMoreToday: false,
    };
  }

  const dateInfo = getDateInfo(now);
  const scheduleType = getScheduleType(now, specialPeriods);

  if (dateInfo.isWeekend) {
    return {
      departures: [],
      isWeekend: true,
      isSpecialSchedule: false,
      scheduleLabel: getScheduleLabel(scheduleType, false),
      hasMoreToday: false,
    };
  }

  const { buses: effectiveBuses, isSpecialSchedule } = applySpecialPeriods({
    buses: Array.isArray(buses) ? buses : [],
    dateString: dateInfo.dateString,
    specialPeriods,
  });

  const departures = effectiveBuses
    .map((bus): NextShuttleDeparture | null => {
      const nextTime = bus.schedules[scheduleType].find((time) => {
        const minutes = timeToMinutes(time);
        return minutes !== null && minutes > dateInfo.currentMinutes;
      });

      if (!nextTime) return null;

      const nextMinutes = timeToMinutes(nextTime);
      if (nextMinutes === null) return null;

      return {
        routeName: bus.routeName,
        time: nextTime,
        minutesUntil: nextMinutes - dateInfo.currentMinutes,
      };
    })
    .filter((item): item is NextShuttleDeparture => item !== null)
    .sort((a, b) => a.minutesUntil - b.minutesUntil);

  return {
    departures: departures.slice(0, limit),
    isWeekend: false,
    isSpecialSchedule,
    scheduleLabel: getScheduleLabel(scheduleType, isSpecialSchedule),
    hasMoreToday: departures.length > 0,
  };
}
