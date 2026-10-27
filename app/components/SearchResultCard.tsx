"use client";

import { Fragment } from "react";
import Link from "next/link";
import type { AcademicSchedule, Announcement, PhoneNumber } from "@/types";
import type { SearchCategoryItem } from "@/lib/home";
import { getSearchSnippet, highlightText } from "@/lib/search";
import { localizePath } from "@/lib/i18n";
import { getCategoryLabel } from "@/lib/utils";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { Badge } from "./Badge";
import { Card } from "./Card";
import { AnnouncementAiSummary } from "./AnnouncementAiSummary";
import { PhoneCallButton } from "./PhoneCallButton";
import { getPhoneDisplayText } from "@/lib/phone";
import { useContentTranslation } from "./ContentTranslation";
import { announcementTranslationFields, splitPublicContentText } from "@/lib/content-translation";

interface SearchResultCardProps {
  item: SearchCategoryItem;
  query?: string;
}

export function SearchResultCard({ item, query = "" }: SearchResultCardProps) {
  if ("phone" in item && "department" in item) {
    return <PhoneSearchResultCard phone={item} query={query} />;
  }

  if ("startDate" in item) return <ScheduleSearchResultCard item={item} query={query} />;
  return <AnnouncementSearchResultCard announcement={item as Announcement} query={query} />;
}

function ScheduleSearchResultCard({ item, query }: { item: AcademicSchedule; query: string }) {
  const dictionary = useDictionary(), locale = useLocale();
  const translation = useContentTranslation({ kind: "schedule", id: item.id }, { title: item.title, ...(item.description ? { description: item.description } : {}) });
  return (
      <Link
        href={{
          pathname: localizePath("/academic/schedule", locale),
          query: query ? { search: query } : undefined,
        }}
        className="block rounded-card focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        aria-label={translation.text("title", item.title)}
      >
        <Card key={item.id} clickable className="border border-neutral-200">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h3 lang={translation.lang} className="font-medium text-neutral-900">
                {highlightText(translation.text("title", item.title), query)}
              </h3>
              <p className="mt-1 text-xs text-neutral-600">
                {item.startDate}
                {item.startDate !== item.endDate ? ` ~ ${item.endDate}` : ""}
              </p>
              {item.description && (
                <p lang={translation.lang} className="mt-2 line-clamp-2 text-xs text-neutral-600">
                  {highlightText(getSearchSnippet(translation.text("description", item.description), query), query)}
                </p>
              )}
            </div>
            <Badge color="gray" size="sm">
              {getCategoryLabel(item.category, dictionary.categories)}
            </Badge>
          </div>
        </Card>
      </Link>
    );
}

function AnnouncementSearchResultCard({ announcement, query }: { announcement: Announcement; query: string }) {
  const dictionary = useDictionary();
  const parts = splitPublicContentText(announcement.content || "");
  const contentFields = announcement.aiSummary?.summary ? {} : Object.fromEntries(parts.map((part, index) => [`contentParts.${index}`, part]));
  const translation = useContentTranslation({ kind: "announcement", id: announcement.id, category: announcement.category }, { ...announcementTranslationFields(announcement), ...contentFields });
  const translatedContent = translation.translated ? parts.map((part, index) => translation.text(`contentParts.${index}`, part)).join("") : announcement.content;
  return (
    <Card key={announcement.id} clickable={Boolean(announcement.url)} className="relative">
      {announcement.url && (
        <a
          href={announcement.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 z-10 rounded-card focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          aria-label={translation.text("title", announcement.title)}
        >
          <span className="sr-only">{translation.text("title", announcement.title)}</span>
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
          <h3 lang={translation.lang} className="font-medium text-neutral-900 line-clamp-2">
            {highlightText(translation.text("title", announcement.title), query)}
          </h3>
          {announcement.aiSummary?.summary ? (
            <AnnouncementAiSummary aiSummary={announcement.aiSummary} compact translation={translation} />
          ) : (
            <p lang={translation.lang} className="mt-2 text-xs text-neutral-600 line-clamp-2">
              {highlightText(getSearchSnippet(translatedContent, query), query)}
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
  const translation = useContentTranslation({ kind: "phone", id: phone.department }, { department: phone.department, ...(phone.description ? { description: phone.description } : {}) });

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 lang={translation.lang} className="font-medium text-neutral-900">
            {highlightText(translation.text("department", phone.department), query)}
          </h3>
          <p className="text-sm text-primary-600 font-semibold mt-1 break-words">
            {getPhoneDisplayText(phone).split(", ").map((number, index) => (
              <Fragment key={`${number}-${index}`}>
                {index > 0 && ", "}
                <span className="inline-block max-w-full">{highlightText(number, query)}</span>
              </Fragment>
            ))}
          </p>
          {phone.description && (
            <p lang={translation.lang} className="mt-1 text-xs text-neutral-600 line-clamp-2">
              {highlightText(translation.text("description", phone.description), query)}
            </p>
          )}
        </div>
        <PhoneCallButton
          department={translation.text("department", phone.department)}
          phone={phone.phone}
          phoneNumbers={phone.phoneNumbers}
          className="shrink-0 px-3"
        >
          {dictionary.labels.phone}
        </PhoneCallButton>
      </div>
    </Card>
  );
}
