import type {
  ShuttleAdditionalService,
  ShuttleBusSchedule,
  ShuttleScheduleType,
  ShuttleServiceException,
  ShuttleSpecialPeriod,
  ShuttleSpecialPeriods,
} from "@/types";
import type { PublicHolidaySnapshot } from "@/types/public-holidays";
import { getKoreaDateTimeParts } from "@/lib/korea-time";
import { getPublicHoliday } from "@/lib/public-holidays";
import { getDictionary, type Locale } from "@/lib/i18n";

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
  additionalService?: ShuttleAdditionalService;
}

export interface CurrentShuttleSummary {
  holiday: ReturnType<typeof getPublicHoliday>;
  operationStatus: "regular" | "unconfirmed" | "closed" | "exception";
  operationEvidence: Pick<ShuttleServiceException, "sourceUrl" | "verifiedAt">[];
  departures: NextShuttleDeparture[];
  additionalServicePeriods: ShuttleSpecialPeriod[];
  isWeekend: boolean;
  isOperatingPeriod: boolean;
  isSpecialSchedule: boolean;
  scheduleLabel: string;
  hasMoreToday: boolean;
}

export function getShuttleDayStatus({
  dateString,
  specialPeriods,
  holidays,
  now = new Date(),
}: {
  dateString: string;
  specialPeriods?: ShuttleSpecialPeriods;
  holidays?: PublicHolidaySnapshot;
  now?: Date;
}) {
  const holiday = getPublicHoliday(dateString, holidays, now);
  const isVerified = (record: { sourceUrl: string; verifiedAt: string }) => {
    const verifiedAt = Date.parse(record.verifiedAt);
    if (!Number.isFinite(verifiedAt) || verifiedAt > now.getTime()) return false;
    try {
      const source = new URL(record.sourceUrl);
      return source.protocol === "https:" && !source.username && !source.password &&
        (source.hostname === "syu.ac.kr" || source.hostname.endsWith(".syu.ac.kr"));
    } catch {
      return false;
    }
  };
  const serviceExceptions = (specialPeriods?.serviceExceptions ?? []).filter(
    (record) => record.date === dateString && isVerified(record) &&
      typeof record.routeId === "string" && record.routeId.length > 0 &&
      Array.isArray(record.times) && record.times.length > 0 &&
      record.times.every((time) => typeof time === "string" && timeToMinutes(time) !== null),
  );
  const closedDate = (specialPeriods?.closedDates ?? []).find(
    (record) => record.date === dateString && isVerified(record),
  );
  const dayOfWeek = new Date(`${dateString.replaceAll(".", "-")}T00:00:00Z`).getUTCDay();
  const operationStatus: CurrentShuttleSummary["operationStatus"] =
    serviceExceptions.length > 0 ? "exception" :
      closedDate || holiday.status === "holiday" || dayOfWeek === 0 || dayOfWeek === 6 ? "closed" :
      holiday.status === "not-holiday" ? "regular" : "unconfirmed";
  const operationEvidence = (operationStatus === "exception" ? serviceExceptions : closedDate ? [closedDate] : [])
    .map(({ sourceUrl, verifiedAt }) => ({ sourceUrl, verifiedAt }));
  return { holiday, operationStatus, serviceExceptions, operationEvidence };
}

export function getShuttleExceptionBuses(
  buses: ShuttleBusSchedule[],
  exceptions: ShuttleServiceException[],
): ShuttleBusSchedule[] {
  return buses.flatMap((bus) => {
    const times = Array.from(new Set(exceptions
      .filter((record) => record.routeId === bus.id)
      .flatMap((record) => record.times)))
      .sort((a, b) => (timeToMinutes(a) ?? 0) - (timeToMinutes(b) ?? 0));
    if (times.length === 0) return [];
    return [{
      ...bus,
      schedules: Object.fromEntries(SCHEDULE_TYPES.map((type) => [type, times])) as ShuttleBusSchedule["schedules"],
    }];
  });
}

export function createScheduleCopy(
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

export function timeToMinutes(time: string): number | null {
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

export function isReplacementSpecialPeriod(
  period: ShuttleSpecialPeriod,
): boolean {
  return period.type === "replace" || Boolean(period.replacementSchedules);
}

export function isDateInSpecialPeriod(
  period: Pick<
    ShuttleSpecialPeriod,
    "applicableDates" | "startDate" | "endDate"
  >,
  dateString: string,
): boolean {
  if (period.applicableDates.length > 0) {
    return period.applicableDates.includes(dateString);
  }

  return dateString >= period.startDate && dateString <= period.endDate;
}

function getDateInfo(now: Date) {
  const { dayOfWeek, year, month, date, hour, minute } =
    getKoreaDateTimeParts(now);

  return {
    currentMinutes: hour * 60 + minute,
    dateString: `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`,
    isFriday: dayOfWeek === 5,
    isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
  };
}

function getRemainingShuttleServices(
  period: ShuttleSpecialPeriod,
  now: Date,
): ShuttleAdditionalService[] {
  const { dateString, currentMinutes } = getDateInfo(now);
  if (!isDateInSpecialPeriod(period, dateString)) return [];

  return (period.additionalServices ?? []).filter((service) => {
    const end = timeToMinutes(
      service.type === "window" ? service.endTime : service.time,
    );
    return end !== null && currentMinutes <= end;
  });
}

export function formatShuttleAdditionalService(
  service: ShuttleAdditionalService,
  locale: Locale,
) {
  const text = getDictionary(locale).pages.busInfo.festivalShuttle;
  const value =
    service.type === "window"
      ? text.window
          .replace("{startTime}", service.startTime)
          .replace("{endTime}", service.endTime)
          .replace("{count}", String(service.vehicleCount))
      : text.departure
          .replace("{time}", service.time)
          .replace("{count}", String(service.vehicleCount));

  return {
    label: text.destinations[service.destination],
    value:
      service.type === "window" ? `${value} · ${text.windowNote}` : value,
  };
}

export function formatShuttleAdditionalCountdown(
  service: ShuttleAdditionalService,
  minutesUntil: number,
  locale: Locale,
): string {
  const text = getDictionary(locale).pages.busInfo.festivalShuttle;
  if (service.type === "window") {
    return minutesUntil > 0
      ? text.windowStartsIn.replace("{minutes}", String(minutesUntil))
      : text.windowScheduled;
  }
  return minutesUntil > 0
    ? text.countdown.replace("{minutes}", String(minutesUntil))
    : text.scheduledNow;
}

export function getShuttleAdditionalServiceBuses({
  specialPeriods,
  dateString,
  locale = "ko",
}: {
  specialPeriods?: ShuttleSpecialPeriods;
  dateString: string;
  locale?: Locale;
}): ShuttleBusSchedule[] {
  return (specialPeriods?.specialPeriods ?? [])
    .filter((period) => isDateInSpecialPeriod(period, dateString))
    .flatMap((period) => (period.additionalServices ?? []).flatMap((service) => {
      const start = timeToMinutes(service.type === "window" ? service.startTime : service.time);
      const end = timeToMinutes(service.type === "window" ? service.endTime : service.time);
      if (start === null || end === null || start > end ||
        !Number.isInteger(service.vehicleCount) || service.vehicleCount < 1 ||
        !["hwarangdae", "byeollae"].includes(service.destination)) return [];
      const routeName = formatShuttleAdditionalService(service, locale).label;
      const [startLocation, endLocation] = routeName.split(" → ");
      return [{
        id: `${period.id}-${service.destination}`,
        routeName, startLocation, endLocation,
        schedules: Object.fromEntries(SCHEDULE_TYPES.map((type) => [type,
          service.type === "departure" ? [service.time] : [],
        ])) as ShuttleBusSchedule["schedules"],
        additionalService: service,
        lastUpdated: "",
      }];
    }));
}

export function getNextShuttleDepartures({
  buses,
  scheduleType,
  currentMinutes,
  includeRegularDepartures = true,
}: {
  buses: ShuttleBusSchedule[];
  scheduleType: ShuttleScheduleType;
  currentMinutes: number;
  includeRegularDepartures?: boolean;
}): NextShuttleDeparture[] {
  return buses.flatMap<NextShuttleDeparture>((bus) => {
    const service = bus.additionalService;
    if (service) {
      const start = timeToMinutes(service.type === "window" ? service.startTime : service.time);
      const end = timeToMinutes(service.type === "window" ? service.endTime : service.time);
      if (start === null || end === null || currentMinutes > end) return [];
      return [{ routeName: bus.routeName,
        time: service.type === "window" ? `${service.startTime}~${service.endTime}` : service.time,
        minutesUntil: Math.max(0, start - currentMinutes), additionalService: service }];
    }
    if (!includeRegularDepartures) return [];
    const time = (bus.schedules[scheduleType] ?? []).find((time) => {
      const minutes = timeToMinutes(time);
      return minutes !== null && minutes > currentMinutes;
    });
    const minutes = time ? timeToMinutes(time) : null;
    return time && minutes !== null
      ? [{ routeName: bus.routeName, time, minutesUntil: minutes - currentMinutes }]
      : [];
  }).sort((a, b) => a.minutesUntil - b.minutesUntil);
}

export function isShuttleVacationDate(
  dateString: string,
  specialPeriods?: ShuttleSpecialPeriods,
): boolean {
  const vacationPeriods = Array.isArray(specialPeriods?.vacationPeriods)
    ? specialPeriods.vacationPeriods
    : [];

  return vacationPeriods.some(
    (period) =>
      dateString >= period.startDate && dateString <= period.endDate,
  );
}

function isShuttleSemesterDate(
  dateString: string,
  specialPeriods?: ShuttleSpecialPeriods,
): boolean {
  const semesterPeriods = Array.isArray(specialPeriods?.semesterPeriods)
    ? specialPeriods.semesterPeriods
    : [];

  return semesterPeriods.some(
    (period) =>
      dateString >= period.startDate && dateString <= period.endDate,
  );
}

export function getShuttleScheduleType(
  now: Date,
  specialPeriods?: ShuttleSpecialPeriods,
): ShuttleScheduleType | null {
  const dateInfo = getDateInfo(now);
  const isVacation = isShuttleVacationDate(
    dateInfo.dateString,
    specialPeriods,
  );

  if (isVacation) {
    return dateInfo.isFriday ? "fridayVacation" : "mondayToThursdayVacation";
  }

  if (isShuttleSemesterDate(dateInfo.dateString, specialPeriods)) {
    return dateInfo.isFriday ? "friday" : "mondayToThursday";
  }

  return null;
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
    isSpecialSchedule: true,
  };
}

export function getCurrentShuttleSummary({
  buses,
  specialPeriods,
  holidays,
  now,
  limit = 3,
}: {
  buses?: ShuttleBusSchedule[];
  specialPeriods?: ShuttleSpecialPeriods;
  holidays?: PublicHolidaySnapshot;
  now: Date | null;
  limit?: number;
}): CurrentShuttleSummary {
  if (!now) {
    return {
      holiday: getPublicHoliday("", holidays),
      operationStatus: "unconfirmed",
      operationEvidence: [],
      departures: [],
      additionalServicePeriods: [],
      isWeekend: false,
      isOperatingPeriod: false,
      isSpecialSchedule: false,
      scheduleLabel: "오늘 시간표",
      hasMoreToday: false,
    };
  }

  const dateInfo = getDateInfo(now);
  const { holiday, operationStatus, serviceExceptions, operationEvidence } = getShuttleDayStatus({
    dateString: dateInfo.dateString, specialPeriods, holidays, now,
  });
  const isException = operationStatus === "exception";
  const scheduleType = getShuttleScheduleType(now, specialPeriods);

  if (operationStatus === "unconfirmed" || operationStatus === "closed") {
    return {
      holiday, operationStatus, operationEvidence, departures: [], additionalServicePeriods: [],
      isWeekend: dateInfo.isWeekend, isOperatingPeriod: scheduleType !== null,
      isSpecialSchedule: false, scheduleLabel: "참고 시간표", hasMoreToday: false,
    };
  }

  if (!scheduleType && !isException) {
    return {
      holiday, operationStatus, operationEvidence,
      departures: [],
      additionalServicePeriods: [],
      isWeekend: false,
      isOperatingPeriod: false,
      isSpecialSchedule: false,
      scheduleLabel: "운행 기간 외",
      hasMoreToday: false,
    };
  }

  const { buses: effectiveBuses, isSpecialSchedule } = isException ? {
    buses: getShuttleExceptionBuses(Array.isArray(buses) ? buses : [], serviceExceptions),
    isSpecialSchedule: true,
  } : applySpecialPeriods({
    buses: Array.isArray(buses) ? buses : [],
    dateString: dateInfo.dateString,
    specialPeriods,
  });
  const additionalServicePeriods = (isException ? [] : specialPeriods?.specialPeriods ?? [])
    .filter((period) => isDateInSpecialPeriod(period, dateInfo.dateString))
    .map((period) => ({
      ...period,
      additionalServices: period.daytimeIntervals
        ? period.additionalServices ?? []
        : getRemainingShuttleServices(period, now),
    }))
    .filter((period) => period.daytimeIntervals || period.additionalServices.length > 0);

  const departures = getNextShuttleDepartures({
    buses: [...effectiveBuses, ...(isException ? [] : getShuttleAdditionalServiceBuses({
      specialPeriods, dateString: dateInfo.dateString,
    }))],
    scheduleType: scheduleType ?? "mondayToThursday",
    currentMinutes: dateInfo.currentMinutes,
    includeRegularDepartures: !additionalServicePeriods.some((period) => period.daytimeIntervals),
  });

  return {
    holiday, operationStatus, operationEvidence,
    departures: departures.slice(0, limit),
    additionalServicePeriods,
    isWeekend: false,
    isOperatingPeriod: true,
    isSpecialSchedule,
    scheduleLabel: getScheduleLabel(scheduleType ?? "mondayToThursday", isSpecialSchedule),
    hasMoreToday:
      departures.length > 0 || additionalServicePeriods.some(
        (period) => getRemainingShuttleServices(period, now).length > 0,
      ),
  };
}
