"use client";

import Link from "next/link";
import type { Announcement, PhoneNumber } from "@/types";
import type { SearchCategoryItem } from "@/lib/home";
import { getSearchSnippet, highlightText } from "@/lib/search";
import { localizePath } from "@/lib/i18n";
import { getCategoryLabel } from "@/lib/utils";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { Badge } from "./Badge";
import { Card } from "./Card";
import { AnnouncementAiSummary } from "./AnnouncementAiSummary";
import { PhoneCallButton } from "./PhoneCallButton";

interface SearchResultCardProps {
  item: SearchCategoryItem;
  query?: string;
}

export function SearchResultCard({ item, query = "" }: SearchResultCardProps) {
  const dictionary = useDictionary();
  const locale = useLocale();

  if ("phone" in item && "department" in item) {
    return <PhoneSearchResultCard phone={item} query={query} />;
  }

  if ("startDate" in item) {
    return (
      <Link
        href={localizePath("/academic/schedule", locale)}
        className="block rounded-card focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        aria-label={item.title}
      >
        <Card key={item.id} clickable className="border border-neutral-200">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className="font-medium text-neutral-900">
                {highlightText(item.title, query)}
              </h4>
              <p className="mt-1 text-xs text-neutral-600">
                {item.startDate}
                {item.startDate !== item.endDate ? ` ~ ${item.endDate}` : ""}
              </p>
              {item.description && (
                <p className="mt-2 line-clamp-2 text-xs text-neutral-600">
                  {highlightText(getSearchSnippet(item.description, query), query)}
                </p>
              )}
            </div>
            <Badge color="gray" size="sm">
              {getCategoryLabel(item.category, locale)}
            </Badge>
          </div>
        </Card>
      </Link>
    );
  }

  const announcement = item as Announcement;
  return (
    <Card key={announcement.id} clickable={Boolean(announcement.url)} className="relative">
      {announcement.url && (
        <a
          href={announcement.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 z-10 rounded-card focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          aria-label={announcement.title}
        >
          <span className="sr-only">{announcement.title}</span>
        </a>
      )}
      <div
        className={
          announcement.url
            ? "pointer-events-none relative z-20 flex items-start justify-between gap-3"
            : "flex items-start justify-between gap-3"
        }
      >
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {announcement.isPinned && (
              <Badge color="red" size="sm">
                {dictionary.labels.pinned}
              </Badge>
            )}
            {announcement.isImportant && (
              <Badge color="yellow" size="sm">
                {dictionary.labels.important}
              </Badge>
            )}
          </div>
          <h4 className="font-medium text-neutral-900 line-clamp-2">
            {highlightText(announcement.title, query)}
          </h4>
          {announcement.aiSummary?.summary ? (
            <AnnouncementAiSummary aiSummary={announcement.aiSummary} compact />
          ) : (
            <p className="mt-2 text-xs text-neutral-600 line-clamp-2">
              {highlightText(getSearchSnippet(announcement.content, query), query)}
            </p>
          )}
          <p className="mt-2 text-xs text-neutral-500">
            {announcement.author} · {announcement.date}
          </p>
        </div>
      </div>
    </Card>
  );
}

function PhoneSearchResultCard({
  phone,
  query,
}: {
  phone: PhoneNumber;
  query: string;
}) {
  const dictionary = useDictionary();

  return (
    <Card key={phone.phone}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <h4 className="font-medium text-neutral-900">
            {highlightText(phone.department, query)}
          </h4>
          <p className="text-sm text-primary-600 font-semibold mt-1">
            {highlightText(phone.phone, query)}
          </p>
          {phone.description && (
            <p className="mt-1 text-xs text-neutral-600 line-clamp-2">
              {highlightText(phone.description, query)}
            </p>
          )}
        </div>
        <PhoneCallButton
          department={phone.department}
          phone={phone.phone}
          phoneNumbers={phone.phoneNumbers}
          className="inline-flex items-center justify-center gap-1.5 rounded bg-primary-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-700"
        >
          {dictionary.labels.phone}
        </PhoneCallButton>
      </div>
    </Card>
  );
}
