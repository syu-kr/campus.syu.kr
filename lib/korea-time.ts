export interface KoreaDateTimeParts {
  year: number;
  month: number;
  date: number;
  dayOfWeek: number;
  hour: number;
  minute: number;
}

const KOREA_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function getKoreaDateTimeParts(now: Date): KoreaDateTimeParts {
  const parts = Object.fromEntries(
    KOREA_DATE_TIME_FORMATTER.formatToParts(now).map(({ type, value }) => [
      type,
      value,
    ]),
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const date = Number(parts.day);

  return {
    year,
    month,
    date,
    dayOfWeek: new Date(Date.UTC(year, month - 1, date)).getUTCDay(),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}
