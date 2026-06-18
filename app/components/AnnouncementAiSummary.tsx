"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { AnnouncementAiSummary as AnnouncementAiSummaryData } from "@/types";
import { useDictionary } from "@/app/components/LocaleProvider";
import { Badge } from "./Badge";
import { Modal } from "./Modal";

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
  const [isOpen, setIsOpen] = useState(false);
  const labels = dictionary.labels.aiSummaryDetails;
  const confidenceLabel = labels.confidence[aiSummary.confidence];

  return (
    <>
      <button
        type="button"
        className={
          compact
            ? "pointer-events-auto mt-2 w-full rounded-md text-left focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            : `pointer-events-auto w-full rounded-md border p-3 text-left transition-colors hover:bg-white/70 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${cardToneClass[aiSummary.importance]}`
        }
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={labels.open}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen(true);
        }}
      >
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Badge color="blue" size="sm">
            {dictionary.labels.aiSummary}
          </Badge>
          <Badge color={importanceBadgeColor[aiSummary.importance]} size="sm">
            {dictionary.labels.aiImportance[aiSummary.importance]}
          </Badge>
          <span className="ml-auto text-xs font-medium text-primary-700">
            {labels.open}
          </span>
        </div>
        <p
          className={
            compact
              ? "line-clamp-2 text-xs text-neutral-600"
              : "line-clamp-2 text-sm leading-6 text-neutral-700"
          }
        >
          {aiSummary.summary}
        </p>
      </button>

      {isOpen &&
        createPortal(
          <Modal
            isOpen={isOpen}
            title={labels.title}
            description={dictionary.labels.aiSummary}
            onClose={() => setIsOpen(false)}
            size="sm"
          >
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  color={importanceBadgeColor[aiSummary.importance]}
                  size="sm"
                >
                  {dictionary.labels.aiImportance[aiSummary.importance]}
                </Badge>
                <Badge color="gray" size="sm">
                  {confidenceLabel}
                </Badge>
              </div>

              <section>
                <h3 className="text-sm font-semibold text-neutral-900">
                  {labels.fields.summary}
                </h3>
                <p className="mt-2 text-sm leading-6 text-neutral-700">
                  {formatAiDetail(aiSummary.summary, labels.empty)}
                </p>
              </section>

              <dl className="space-y-4">
                <AiDetailRow
                  label={labels.fields.target}
                  value={formatAiDetail(aiSummary.target, labels.empty)}
                />
                <AiDetailRow
                  label={labels.fields.deadline}
                  value={formatAiDetail(aiSummary.deadline, labels.empty)}
                />
                <AiDetailRow
                  label={labels.fields.requiredAction}
                  value={formatAiDetail(aiSummary.requiredAction, labels.empty)}
                />
              </dl>

              {aiSummary.keywords.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-neutral-900">
                    {labels.fields.keywords}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {aiSummary.keywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </Modal>,
          document.body,
        )}
    </>
  );
}

function AiDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-neutral-900">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-neutral-700">{value}</dd>
    </div>
  );
}

function formatAiDetail(value: string, fallback: string) {
  const normalized = value.trim();

  if (!normalized || normalized.toLowerCase() === "unknown") {
    return fallback;
  }

  return normalized;
}
