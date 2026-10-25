"use client";

import type { AnnouncementAiSummary as AnnouncementAiSummaryData } from "@/types";
import { useDictionary } from "@/app/components/LocaleProvider";
import { Badge } from "./Badge";

interface AnnouncementAiSummaryProps {
  aiSummary: AnnouncementAiSummaryData;
  compact?: boolean;
  showPreview?: boolean;
  variant?: "action" | "preview";
}

const importanceBadgeColor = { high: "red", normal: "yellow", low: "gray" } as const;

export function AnnouncementAiSummary({ aiSummary, compact = false }: AnnouncementAiSummaryProps) {
  const dictionary = useDictionary();
  const labels = dictionary.labels.aiSummaryDetails;
  const actionFields = ["deadline", "requiredAction"] as const;

  return (
    <div className={"notice-inline-summary pointer-events-auto" + (compact ? " notice-inline-summary-compact" : "")} data-notice-inline-summary>
      <div className="notice-inline-summary-header">
        <strong>{dictionary.labels.aiSummary}</strong>
        <Badge color={importanceBadgeColor[aiSummary.importance]} size="sm">
          {dictionary.labels.aiImportance[aiSummary.importance]}
        </Badge>
        <span className="notice-inline-summary-caution">{labels.caution}</span>
      </div>
      <p className="notice-inline-summary-text">{formatAiDetail(aiSummary.summary, labels.empty)}</p>
      <dl className="notice-inline-summary-details">
        {actionFields.map((field) => (
          <div key={field}>
            <dt>{labels.fields[field]}</dt>
            <dd>{formatAiDetail(aiSummary[field], labels.empty)}</dd>
          </div>
        ))}
      </dl>
      <details className="notice-inline-summary-more">
        <summary className="m3-disclosure-trigger">{labels.more}</summary>
        <div className="notice-inline-summary-extra">
          <dl className="notice-inline-summary-audience">
            <div><dt>{labels.fields.target}</dt><dd>{formatAiDetail(aiSummary.target, labels.empty)}</dd></div>
          </dl>
          <p className="notice-inline-summary-confidence">{labels.confidence[aiSummary.confidence]}</p>
          {aiSummary.keywords.length > 0 && (
            <ul className="notice-inline-summary-keywords" aria-label={labels.fields.keywords}>
              {aiSummary.keywords.map((keyword, index) => <li key={keyword + "-" + index}>{keyword}</li>)}
            </ul>
          )}
          <p className="notice-inline-summary-source">{dictionary.pages.announcements.sourceNotice}</p>
        </div>
      </details>
    </div>
  );
}

function formatAiDetail(value: string, fallback: string) {
  const normalized = value.trim();
  return !normalized || normalized.toLowerCase() === "unknown" ? fallback : normalized;
}
