export interface KmaForecastItem {
  category: string;
  fcstDate?: string;
  fcstTime?: string;
  fcstValue?: string;
}

export interface ForecastCategorySelection {
  values: Record<string, number>;
  selectedDateTime: string | null;
}

export function buildForecastCategoryMap(
  items: KmaForecastItem[],
  targetDateTime: string,
): ForecastCategorySelection {
  const availableDateTimes = Array.from(
    new Set(
      items
        .map(readForecastDateTime)
        .filter((value): value is string => value !== null),
    ),
  ).sort();

  if (availableDateTimes.length === 0) {
    return { values: {}, selectedDateTime: null };
  }

  const selectedDateTime =
    availableDateTimes.find((value) => value >= targetDateTime) ??
    availableDateTimes[availableDateTimes.length - 1];
  const values: Record<string, number> = {};

  items.forEach((item) => {
    if (
      readForecastDateTime(item) !== selectedDateTime ||
      values[item.category] !== undefined
    ) {
      return;
    }

    const numericValue = Number(item.fcstValue);
    if (Number.isFinite(numericValue)) {
      values[item.category] = numericValue;
    }
  });

  return { values, selectedDateTime };
}

function readForecastDateTime(item: KmaForecastItem): string | null {
  if (
    !item.fcstDate ||
    !/^\d{8}$/.test(item.fcstDate) ||
    !item.fcstTime ||
    !/^(?:[01]\d|2[0-3])[0-5]\d$/.test(item.fcstTime)
  ) {
    return null;
  }

  return `${item.fcstDate}${item.fcstTime}`;
}
