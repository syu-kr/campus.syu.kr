"use client";

import { memo } from "react";
import Link from "next/link";
import { Announcement } from "@/types";
import { Card } from "./Card";
import { Badge } from "./Badge";
import {
  getCategoryLabel,
  getCategoryColor,
  formatDateWithYear,
} from "@/lib/utils";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { AnnouncementAiSummary } from "./AnnouncementAiSummary";

interface AnnouncementCardProps {
  announcement: Announcement;
  aiSummaryMode?: "action" | "preview";
  href?: string;
  clickable?: boolean;
  external?: boolean;
}

function AnnouncementCardComponent({
  announcement,
  aiSummaryMode = "action",
  href,
  clickable = true,
  external = false,
}: AnnouncementCardProps) {
  const locale = useLocale();
  const dictionary = useDictionary();
  const overlayLabel = `${announcement.title} ${dictionary.labels.notice}`;
  const overlayClassName =
    "absolute inset-0 z-10 rounded-card focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2";
  const content = (
    <Card
      as="article"
      clickable={Boolean(href) && clickable}
      className={href ? "relative" : ""}
    >
      {href &&
        (external ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={overlayClassName}
            aria-label={overlayLabel}
          >
            <span className="sr-only">{overlayLabel}</span>
          </a>
        ) : (
          <Link
            href={href}
            prefetch={false}
            className={overlayClassName}
            aria-label={overlayLabel}
          >
            <span className="sr-only">{overlayLabel}</span>
          </Link>
        ))}
      <div
        className={
          href
            ? "pointer-events-none relative z-20 flex flex-col gap-3"
            : "flex flex-col gap-3"
        }
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Badge color={getCategoryColor(announcement.category)} size="sm">
            {getCategoryLabel(announcement.category, locale)}
          </Badge>
          {announcement.isPinned && (
            <Badge color="red" size="sm">
              {dictionary.labels.pinned}
            </Badge>
          )}
          {announcement.isImportant && (
            <Badge color="red" size="sm">
              {dictionary.labels.notice}
            </Badge>
          )}
        </div>
        <h3 className="font-semibold text-neutral-900 line-clamp-2">
          {announcement.title}
        </h3>
        {announcement.aiSummary?.summary && aiSummaryMode === "preview" && (
          <AnnouncementAiSummary
            aiSummary={announcement.aiSummary}
            variant="preview"
          />
        )}
        {announcement.aiSummary?.summary && aiSummaryMode === "action" && (
          <AnnouncementAiSummary aiSummary={announcement.aiSummary} />
        )}
        <div className="flex items-center justify-between text-xs text-neutral-500 pt-2 border-t border-neutral-100">
          <span>{formatDateWithYear(announcement.date)}</span>
          <span>{announcement.author || dictionary.labels.sahmyookUniversity}</span>
        </div>
      </div>
    </Card>
  );

  return content;
}

export const AnnouncementCard = memo(AnnouncementCardComponent);
