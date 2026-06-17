"use client";

import type { AnnouncementAiSummary as AnnouncementAiSummaryData } from "@/types";
import { useDictionary } from "@/app/components/LocaleProvider";
import { Badge } from "./Badge";

type AiImportance = AnnouncementAiSummaryData["importance"];
type BadgeColor = "blue" | "red" | "green" | "yellow" | "purple" | "gray";

interface AnnouncementAiSummaryProps {
  aiSummary: AnnouncementAiSummaryData;
  compact?: boolean;
}

const importanceBadgeColor: Record<AiImportance, BadgeColor> = {
  high: "red",
  normal: "yellow",
  low: "gray",
};

const cardToneClass: Record<AiImportance, string> = {
  high: "border-red-100 bg-red-50/50",
  normal: "border-yellow-100 bg-yellow-50/60",
  low: "border-neutral-200 bg-neutral-50",
};

export function AnnouncementAiSummary({
  aiSummary,
  compact = false,
}: AnnouncementAiSummaryProps) {
  const dictionary = useDictionary();

  return (
    <div
      className={
        compact
          ? "mt-2"
          : `rounded-md border p-3 ${cardToneClass[aiSummary.importance]}`
      }
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Badge color="blue" size="sm">
          {dictionary.labels.aiSummary}
        </Badge>
        <Badge color={importanceBadgeColor[aiSummary.importance]} size="sm">
          {dictionary.labels.aiImportance[aiSummary.importance]}
        </Badge>
      </div>
      <p
        className={
          compact
            ? "text-xs text-neutral-600 line-clamp-2"
            : "text-sm leading-6 text-neutral-700 line-clamp-2"
        }
      >
        {aiSummary.summary}
      </p>
    </div>
  );
}
