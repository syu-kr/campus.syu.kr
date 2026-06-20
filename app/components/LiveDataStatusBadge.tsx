"use client";

import type { Locale } from "@/lib/i18n";
import type { LiveDataSourceStatus } from "@/types/live-data";
import { useDictionary } from "@/app/components/LocaleProvider";
import clsx from "clsx";

interface LiveDataStatusBadgeProps {
  locale: Locale;
  sourceLabel: string;
  timestamp?: string | Date | null;
  stale?: boolean;
  sourceStatus?: LiveDataSourceStatus;
  className?: string;
}

const STATUS_STYLES: Record<LiveDataSourceStatus, string> = {
  fresh: "border-emerald-200 bg-emerald-50 text-emerald-700",
  stale: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-red-200 bg-red-50 text-red-700",
};

export function LiveDataStatusBadge({
  locale,
  sourceLabel,
  timestamp,
  stale = false,
  sourceStatus,
  className,
}: LiveDataStatusBadgeProps) {
  const text = useDictionary().liveData;
  const status = sourceStatus ?? (stale ? "stale" : "fresh");
  const formattedTime = formatTimestamp(timestamp, locale, text.unavailable);

  return (
    <div
      className={clsx(
        "flex flex-wrap items-center gap-2 text-xs text-neutral-500",
        className,
      )}
      aria-live="polite"
    >
      <span
        className={clsx(
          "inline-flex items-center rounded-full border px-2 py-0.5 font-semibold",
          STATUS_STYLES[status],
        )}
      >
        {text.statuses[status]}
      </span>
      <span>
        {text.updated}: {formattedTime}
      </span>
      <span className="text-neutral-400">|</span>
      <span>
        {text.source}: {sourceLabel}
      </span>
    </div>
  );
}

function formatTimestamp(
  timestamp: string | Date | null | undefined,
  locale: Locale,
  unavailable: string,
) {
  if (!timestamp) return unavailable;

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return unavailable;

  return date.toLocaleTimeString(locale === "ko" ? "ko-KR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
