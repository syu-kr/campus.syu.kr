"use client";

import React, { memo } from "react";
import Link from "next/link";
import { Announcement } from "@/types";
import { Card } from "./Card";
import { Badge } from "./Badge";
import {
  getCategoryLabel,
  getCategoryColor,
  formatDateWithYear,
} from "@/lib/utils";

interface AnnouncementCardProps {
  announcement: Announcement;
  href?: string;
  clickable?: boolean;
  external?: boolean;
}

function AnnouncementCardComponent({
  announcement,
  href,
  clickable = true,
  external = false,
}: AnnouncementCardProps) {
  const content = (
    <Card
      as="article"
      clickable={clickable}
      className={href ? "hover:shadow-card-hover" : ""}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge color={getCategoryColor(announcement.category)} size="sm">
            {getCategoryLabel(announcement.category)}
          </Badge>
          {announcement.isPinned && (
            <Badge color="red" size="sm">
              고정글
            </Badge>
          )}
          {announcement.isImportant && (
            <Badge color="red" size="sm">
              공지
            </Badge>
          )}
        </div>
        <h3 className="font-semibold text-neutral-900 line-clamp-2">
          {announcement.title}
        </h3>
        <div className="flex items-center justify-between text-xs text-neutral-500 pt-2 border-t border-neutral-100">
          <span>{formatDateWithYear(announcement.date)}</span>
          <span>{announcement.author || "삼육대학교"}</span>
        </div>
      </div>
    </Card>
  );

  if (href) {
    if (external) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      );
    }
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

export const AnnouncementCard = memo(AnnouncementCardComponent);

export default AnnouncementCard;
