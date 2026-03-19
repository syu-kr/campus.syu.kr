"use client";

import React from "react";
import Link from "next/link";
import { Announcement } from "@/types";
import { Card } from "./Card";
import { Badge } from "./Badge";
import {
  getCategoryLabel,
  getCategoryColor,
  formatDate,
  getFirstLine,
} from "@/lib/utils";

interface AnnouncementCardProps {
  announcement: Announcement;
  href?: string;
  clickable?: boolean;
  external?: boolean;
}

export function AnnouncementCard({
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
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge color={getCategoryColor(announcement.category)} size="sm">
              {getCategoryLabel(announcement.category)}
            </Badge>
            {announcement.isImportant && (
              <Badge color="red" size="sm">
                공지
              </Badge>
            )}
          </div>
          <h3 className="font-semibold text-neutral-900 mb-1 line-clamp-2">
            {announcement.title}
          </h3>
          <p className="text-sm text-neutral-600 line-clamp-1">
            {getFirstLine(announcement.content)}
          </p>
          <div className="flex items-center gap-4 mt-3 text-xs text-neutral-500">
            <span>{announcement.author || "삼육대학교"}</span>
            <span>{formatDate(announcement.date)}</span>
            <span>조회 {announcement.views.toLocaleString()}</span>
          </div>
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

export default AnnouncementCard;
