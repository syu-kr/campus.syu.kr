"use client";

import type { AnnouncementAiSummary as AnnouncementAiSummaryData } from "@/types";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { Badge } from "./Badge";
import type { useContentTranslation } from "./ContentTranslation";

interface AnnouncementAiSummaryProps {
  aiSummary: AnnouncementAiSummaryData;
  compact?: boolean;
  showPreview?: boolean;
  variant?: "action" | "preview";
  translation?: ReturnType<typeof useContentTranslation>;
}

const importanceBadgeColor = { high: "red", normal: "yellow", low: "gray" } as const;

export function AnnouncementAiSummary({ aiSummary, compact = false, variant = "action", translation }: AnnouncementAiSummaryProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const labels = dictionary.labels.aiSummaryDetails;
  const preview = variant === "preview";
  const hasDeadline = Boolean(aiSummary.deadline.trim()) && aiSummary.deadline.trim().toLowerCase() !== "unknown";
  const actionFields = preview ? (hasDeadline ? ["deadline"] as const : []) : ["deadline", "requiredAction"] as const;
  const detail = (field: "summary" | "deadline" | "requiredAction" | "target") => {
    const original = formatAiDetail(aiSummary[field], labels.empty);
    return original === labels.empty ? original : translation?.text(`aiSummary.${field}`, original) ?? original;
  };
  const detailLang = (value: string) => value === labels.empty ? locale : translation?.lang ?? "ko";

  return (
    <div className={"notice-inline-summary pointer-events-auto" + (compact ? " notice-inline-summary-compact" : "") + (preview ? " notice-inline-summary-preview" : "")} data-notice-inline-summary>
      <div className="notice-inline-summary-header">
        <strong>{dictionary.labels.aiSummary}</strong>
        <Badge color={importanceBadgeColor[aiSummary.importance]} size="sm">
          {dictionary.labels.aiImportance[aiSummary.importance]}
        </Badge>
        <span className="notice-inline-summary-caution">{labels.caution}</span>
      </div>
      <p lang={detailLang(detail("summary"))} className="notice-inline-summary-text">{detail("summary")}</p>
      {actionFields.length > 0 && <dl className="notice-inline-summary-details">
        {actionFields.map((field) => (
          <div key={field}>
            <dt>{labels.fields[field]}</dt>
            <dd lang={detailLang(detail(field))}>{detail(field)}</dd>
          </div>
        ))}
      </dl>}
      <details className="notice-inline-summary-more">
        <summary className="m3-disclosure-trigger">{preview ? labels.previewMore : labels.more}</summary>
        <div className="notice-inline-summary-extra">
          <dl className="notice-inline-summary-audience">
            {preview && <div><dt>{labels.fields.requiredAction}</dt><dd lang={detailLang(detail("requiredAction"))}>{detail("requiredAction")}</dd></div>}
            <div><dt>{labels.fields.target}</dt><dd lang={detailLang(detail("target"))}>{detail("target")}</dd></div>
          </dl>
          <p className="notice-inline-summary-confidence">{labels.confidence[aiSummary.confidence]}</p>
          {aiSummary.keywords.length > 0 && (
            <ul className="notice-inline-summary-keywords" aria-label={labels.fields.keywords}>
              {aiSummary.keywords.map((keyword, index) => <li lang={translation?.lang ?? "ko"} key={keyword + "-" + index}>{translation?.text(`aiSummary.keywords.${index}`, keyword) ?? keyword}</li>)}
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
