import { isCafeteriaClosedDay, isClosedMealItems } from "@/lib/cafeteria";
import { getDictionary, type Locale } from "@/lib/i18n";
import type { TodayInfo } from "@/lib/home";
import {
  formatShuttleAdditionalService,
  type CurrentShuttleSummary,
} from "@/lib/shuttle-schedule";
import type { AnswerSummary, CafeteriaMenu, MenuItem } from "@/types";

function getTodayCafeteriaMenu(
  menus: CafeteriaMenu[],
  todayInfo: TodayInfo,
): CafeteriaMenu | null {
  if (todayInfo.isWeekend) return null;

  return (
    menus.find((menu) => menu.date === todayInfo.dateStringDash) ?? null
  );
}

export function createCafeteriaAnswerSummary({
  locale,
  menus,
  now,
  todayInfo,
}: {
  locale: Locale;
  menus: CafeteriaMenu[];
  now: Date;
  todayInfo: TodayInfo;
}): AnswerSummary {
  const dictionary = getDictionary(locale);
  const text = dictionary.pages.cafeteria;
  const answerText = text.answer;
  const todayMenu = getTodayCafeteriaMenu(menus, todayInfo);
  const baseSummary = {
    eyebrow: answerText.eyebrow,
    title: answerText.title,
    question: answerText.question,
    source: answerText.source,
    updatedAt: formatUpdatedAt(now, locale, answerText.updatedPrefix),
  };

  if (todayInfo.isWeekend) {
    return {
      ...baseSummary,
      answer: answerText.weekend,
    };
  }

  if (!todayMenu) {
    return {
      ...baseSummary,
      answer: todayInfo.dayOfWeek === 1 ? answerText.pending : answerText.missing,
    };
  }

  if (isCafeteriaClosedDay(todayMenu)) {
    return {
      ...baseSummary,
      answer: answerText.closed,
    };
  }

  const items = [
    {
      label: text.breakfast,
      value: formatMealItems(todayMenu.breakfast, text.closedMeal),
    },
    {
      label: `${text.lunch} ${text.cornerA}`,
      value: formatMealItems(todayMenu.lunch.a, text.closedMeal),
    },
    {
      label: `${text.lunch} ${text.cornerB}`,
      value: formatMealItems(todayMenu.lunch.b, text.closedMeal),
    },
    {
      label: text.dinner,
      value: formatMealItems(todayMenu.dinner, text.closedMeal),
    },
  ];
  const itemSummary = items
    .map((item) =>
      [item.label, item.value].join(answerText.mealPairSeparator),
    )
    .join(answerText.mealSeparator);

  return {
    ...baseSummary,
    answer: applyTemplate(answerText.menu, {
      date: todayMenu.date,
      items: itemSummary,
      location: todayMenu.location,
    }),
    items,
  };
}

export function createShuttleAnswerSummary({
  locale,
  now,
  summary,
}: {
  locale: Locale;
  now: Date;
  summary: CurrentShuttleSummary;
}): AnswerSummary {
  const dictionary = getDictionary(locale);
  const text = dictionary.pages.busInfo;
  const answerText = text.answer;
  const primaryDeparture = summary.departures[0];
  const serviceText = text.festivalShuttle;
  const additionalItems = summary.additionalServicePeriods.flatMap((period) =>
    (period.additionalServices ?? []).map((service) =>
      formatShuttleAdditionalService(service, locale),
    ),
  );
  const additionalAnswer = summary.additionalServicePeriods
    .map((period) =>
      applyTemplate(serviceText.answer, {
        date: period.startDate,
        services: (period.additionalServices ?? [])
          .map((service) => {
            const item = formatShuttleAdditionalService(service, locale);
            return `${item.label}: ${item.value}`;
          })
          .join("; "),
      }),
    )
    .join(" ");
  const festivalAnswer = additionalAnswer
    ? `${additionalAnswer} ${serviceText.boarding}. ${serviceText.notice}`
    : "";
  const baseSummary: Omit<AnswerSummary, "answer" | "items"> = {
    eyebrow: answerText.eyebrow,
    title: answerText.title,
    question: answerText.question,
    source: answerText.source,
    updatedAt: formatUpdatedAt(now, locale, answerText.updatedPrefix),
  };

  if (summary.operationEvidence.length > 0) {
    baseSummary.source = `${text.verifiedSource}: ${Array.from(new Set(
      summary.operationEvidence.map((record) => record.sourceUrl),
    )).join(" · ")}`;
    const verifiedAt = Math.min(...summary.operationEvidence.map((record) => Date.parse(record.verifiedAt)));
    baseSummary.updatedAt = formatUpdatedAt(new Date(verifiedAt), locale, text.verifiedAt);
  }

  if (summary.operationStatus === "unconfirmed" || summary.operationStatus === "closed") {
    return {
      ...baseSummary,
      answer: summary.holiday.status === "holiday"
        ? applyTemplate(dictionary.publicHolidays.shuttleHolidayClosedNamed, {
          holiday: summary.holiday.names.join(" · "),
        })
        : summary.operationStatus === "closed"
          ? summary.isWeekend && summary.operationEvidence.length === 0
            ? answerText.weekend
            : dictionary.publicHolidays.shuttleClosed
          : `${dictionary.publicHolidays.shuttleUnconfirmed} ${dictionary.publicHolidays.referenceSchedule}`,
    };
  }

  if (summary.isWeekend) {
    return {
      ...baseSummary,
      answer: answerText.weekend,
    };
  }

  if (!summary.isOperatingPeriod) {
    return {
      ...baseSummary,
      answer: answerText.outOfPeriod,
    };
  }

  if (!primaryDeparture || primaryDeparture.additionalService) {
    return {
      ...baseSummary,
      source: festivalAnswer ? serviceText.source : baseSummary.source,
      answer: festivalAnswer || answerText.noMore,
      ...(festivalAnswer ? { items: additionalItems } : {}),
    };
  }

  return {
    ...baseSummary,
    source: festivalAnswer
      ? `${baseSummary.source} / ${serviceText.source}`
      : baseSummary.source,
    answer: `${applyTemplate(summary.operationStatus === "exception"
      ? answerText.confirmedDeparture : answerText.nextDeparture, {
      minutes: String(primaryDeparture.minutesUntil),
      routeName: primaryDeparture.routeName,
      time: primaryDeparture.time,
    })}${festivalAnswer ? ` ${festivalAnswer}` : ""}`,
    items: [
      ...summary.departures.filter((departure) => !departure.additionalService).map((departure) => ({
        label: departure.routeName,
        value: applyTemplate(answerText.departureItem, {
          minutes: String(departure.minutesUntil),
          time: departure.time,
        }),
      })),
      ...additionalItems,
    ],
  };
}

function formatMealItems(items: MenuItem[] | undefined, closedMeal: string) {
  if (isClosedMealItems(items)) return closedMeal;

  return items?.map((item) => item.name).join(", ") || closedMeal;
}

function formatUpdatedAt(now: Date, locale: Locale, prefix: string) {
  const dateTime = new Intl.DateTimeFormat(
    locale === "ko" ? "ko-KR" : "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Seoul",
    },
  ).format(now);

  return `${prefix} ${dateTime}`;
}

function applyTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  );
}
