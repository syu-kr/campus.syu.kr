"use client";

import Link from "next/link";
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
  showCountdown = true,
  href,
}: {
  period: ShuttleSpecialPeriod;
  now: Date;
  showCountdown?: boolean;
  href?: string;
}) {
  const locale = useLocale();
  const text = useDictionary().pages.busInfo.festivalShuttle;
  const { year, month, date, hour, minute } = getKoreaDateTimeParts(now);
  const dateString = `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
  const isToday = isDateInSpecialPeriod(period, dateString);
  if (!isToday) return null;
  const intervals = period.daytimeIntervals;
  const title = intervals ? text.noticeTitle : text.title;
  const dateLabel = new Intl.DateTimeFormat(
    locale === "ko" ? "ko-KR" : "en-US",
    { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" },
  ).format(new Date(`${period.startDate}T00:00:00+09:00`));

  return (
    <Card
      as="section"
      aria-label={`${dateLabel} ${title}`}
      className="relative border border-primary-200 bg-primary-50/70"
      hover={Boolean(href)}
      clickable={Boolean(href)}
    >
      <time
        dateTime={period.startDate}
        className="text-xs font-semibold text-primary-700"
      >
        {dateLabel}
      </time>
      <h2 className="mt-1 text-base font-bold text-neutral-900">
        {href ? (
          <Link
            href={href}
            className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-primary-500"
          >
            {title}
          </Link>
        ) : title}
      </h2>
      {intervals && (
        <>
          <h3 className="mt-4 text-sm font-semibold text-neutral-900">{text.daytimeTitle}</h3>
          <ul className="mt-1 space-y-1 text-sm leading-6 text-neutral-700">
            <li>{text.daytimeBefore.replace("{time}", intervals.changeTime).replace("{minutes}", String(intervals.beforeMinutes))}</li>
            <li>{text.daytimeAfter.replace("{time}", intervals.changeTime).replace("{minutes}", String(intervals.afterMinutes))}</li>
          </ul>
          <p className="mt-2 text-xs leading-5 text-neutral-700">{text.daytimeNotice}</p>
          <h3 className="mt-4 text-sm font-semibold text-neutral-900">{text.nightTitle}</h3>
        </>
      )}
      <ul className="mt-3 space-y-3">
        {period.additionalServices?.map((service) => {
          const item = formatShuttleAdditionalService(service, locale);
          const departureMinutes =
            service.type === "departure" ? timeToMinutes(service.time) : null;
          const minutesUntil =
            showCountdown && isToday && departureMinutes !== null
              ? departureMinutes - (hour * 60 + minute)
              : null;

          return (
            <li key={service.destination}>
              <p className="text-sm font-semibold text-neutral-900">{item.label}</p>
              <p className="mt-1 text-sm leading-6 text-neutral-700">
                {intervals ? item.value.replace(text.windowNote, text.fullDepartureNote) : item.value}
              </p>
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
      {!intervals && (
        <>
          <p className="mt-4 text-sm leading-6 text-neutral-800">{text.boarding}</p>
          <p className="mt-2 text-xs leading-5 text-neutral-700">{text.notice}</p>
        </>
      )}
      <p className="mt-2 text-xs text-neutral-500">{intervals ? text.noticeSource : text.source}</p>
      {period.sourceUrl && (
        <a href={period.sourceUrl} target="_blank" rel="noopener noreferrer"
          className="relative z-10 mt-2 inline-block text-sm text-primary-700 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          {text.sourceLink}
        </a>
      )}
    </Card>
  );
}
