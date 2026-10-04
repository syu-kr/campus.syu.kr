"use client";

import { Card } from "@/app/components/Card";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { getKoreaDateTimeParts } from "@/lib/korea-time";
import {
  formatShuttleAdditionalService,
  isDateInSpecialPeriod,
  timeToMinutes,
} from "@/lib/shuttle-schedule";
import type { ShuttleSpecialPeriod } from "@/types";

export function ShuttleAdditionalServicesCard({
  period,
  now,
}: {
  period: ShuttleSpecialPeriod;
  now: Date;
}) {
  const locale = useLocale();
  const text = useDictionary().pages.busInfo.festivalShuttle;
  const { year, month, date, hour, minute } = getKoreaDateTimeParts(now);
  const dateString = `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
  const isToday = isDateInSpecialPeriod(period, dateString);
  const dateLabel = new Intl.DateTimeFormat(
    locale === "ko" ? "ko-KR" : "en-US",
    { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" },
  ).format(new Date(`${period.startDate}T00:00:00+09:00`));

  return (
    <Card
      as="section"
      aria-label={`${dateLabel} ${text.title}`}
      className="border border-primary-200 bg-primary-50/70"
      hover={false}
    >
      <time
        dateTime={period.startDate}
        className="text-xs font-semibold text-primary-700"
      >
        {dateLabel}
      </time>
      <p className="mt-1 text-base font-bold text-neutral-900">{text.title}</p>
      <ul className="mt-3 space-y-3">
        {period.additionalServices?.map((service) => {
          const item = formatShuttleAdditionalService(service, locale);
          const departureMinutes =
            service.type === "departure" ? timeToMinutes(service.time) : null;
          const minutesUntil =
            isToday && departureMinutes !== null
              ? departureMinutes - (hour * 60 + minute)
              : null;

          return (
            <li key={service.destination}>
              <p className="text-sm font-semibold text-neutral-900">{item.label}</p>
              <p className="mt-1 text-sm leading-6 text-neutral-700">{item.value}</p>
              {minutesUntil !== null && minutesUntil >= 0 && (
                <p className="mt-1 text-xs font-medium text-primary-700">
                  {minutesUntil === 0
                    ? text.scheduledNow
                    : text.countdown.replace("{minutes}", String(minutesUntil))}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm leading-6 text-neutral-800">{text.boarding}</p>
      <p className="mt-2 text-xs leading-5 text-neutral-700">{text.notice}</p>
      <p className="mt-2 text-xs text-neutral-500">{text.source}</p>
    </Card>
  );
}
