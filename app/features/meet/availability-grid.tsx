import type { PointerEvent } from "react";
import type { MeetParticipant } from "@/types/meet";
import type { Locale } from "@/lib/i18n";

export interface TimeRowProps {
  time: string;
  dates: string[];
  availability: Set<string>;
  participantBySlot: Map<string, MeetParticipant[]>;
  compact?: boolean;
  readOnly?: boolean;
  selectableTitle?: string;
  onPointerDown: (
    event: PointerEvent<HTMLButtonElement>,
    slot: string,
  ) => void;
  onPointerEnter: (slot: string) => void;
}

export function TimeRow({
  time,
  dates,
  availability,
  participantBySlot,
  compact = false,
  readOnly = false,
  selectableTitle = "Selectable",
  onPointerDown,
  onPointerEnter,
}: TimeRowProps) {
  return (
    <>
      <div className="sticky left-0 z-10 border-b border-r border-neutral-200 bg-white p-2 text-xs font-semibold text-neutral-600">
        {time}
      </div>
      {dates.map((date) => {
        const slot = `${date}T${time}:00+09:00`;
        const selected = availability.has(slot);
        const participants = participantBySlot.get(slot) || [];

        return (
          <button
            key={slot}
            type="button"
            data-slot={slot}
            disabled={readOnly}
            onPointerDown={(event) => {
              if (!readOnly) onPointerDown(event, slot);
            }}
            onPointerEnter={() => {
              if (!readOnly) onPointerEnter(slot);
            }}
            className={`${compact ? "h-11" : "h-10"} border-b border-r border-neutral-200 text-xs transition-colors ${
              selected
                ? "bg-primary-600 text-white"
                : participants.length > 0
                  ? "bg-blue-50 text-blue-900 hover:bg-blue-100"
                  : "bg-white text-neutral-500 hover:bg-neutral-50"
            } ${readOnly ? "cursor-default" : ""}`}
            title={
              participants.length > 0
                ? participants.map((participant) => participant.nickname).join(", ")
                : selectableTitle
            }
          >
            {participants.length > 0 ? participants.length : ""}
          </button>
        );
      })}
    </>
  );
}

export function formatDateTimeLabel(
  value: string | null,
  locale: Locale = "ko",
  fallback?: string,
): string {
  if (!value) {
    return (
      fallback ??
      (locale === "en" ? "No deadline information" : "마감 시간 정보 없음")
    );
  }

  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export function formatDateLabel(date: string, locale: Locale = "ko"): string {
  if (!date) return "";

  const parsed = new Date(`${date}T00:00:00+09:00`);
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul",
  }).format(parsed);
}
