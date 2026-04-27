"use client";

import type { Announcement, PhoneNumber } from "@/types";
import type { SearchCategoryItem } from "@/lib/home";
import { getSearchSnippet, highlightText } from "@/lib/search";
import { Badge } from "./Badge";
import { Card } from "./Card";

interface SearchResultCardProps {
  item: SearchCategoryItem;
  query?: string;
}

export function SearchResultCard({ item, query = "" }: SearchResultCardProps) {
  if ("phone" in item && "department" in item) {
    return <PhoneSearchResultCard phone={item} query={query} />;
  }

  if ("startDate" in item) {
    return (
      <Card key={item.id}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h4 className="font-medium text-neutral-900">
              {highlightText(item.title, query)}
            </h4>
            <p className="text-xs text-neutral-600 mt-1">
              {item.startDate}
              {item.startDate !== item.endDate ? ` ~ ${item.endDate}` : ""}
            </p>
            {item.description && (
              <p className="mt-2 text-xs text-neutral-600 line-clamp-2">
                {highlightText(getSearchSnippet(item.description, query), query)}
              </p>
            )}
          </div>
          <Badge color="gray" size="sm">
            {getScheduleCategoryLabel(item.category)}
          </Badge>
        </div>
      </Card>
    );
  }

  const announcement = item as Announcement;
  return (
    <a
      href={announcement.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      <Card key={announcement.id} className="hover:shadow-card-hover">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {announcement.isPinned && <Badge color="red" size="sm">고정글</Badge>}
              {announcement.isImportant && (
                <Badge color="yellow" size="sm">중요</Badge>
              )}
            </div>
            <h4 className="font-medium text-neutral-900 line-clamp-2">
              {highlightText(announcement.title, query)}
            </h4>
            <p className="mt-2 text-xs text-neutral-600 line-clamp-2">
              {highlightText(getSearchSnippet(announcement.content, query), query)}
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              {announcement.author} · {announcement.date}
            </p>
          </div>
        </div>
      </Card>
    </a>
  );
}

function PhoneSearchResultCard({
  phone,
  query,
}: {
  phone: PhoneNumber;
  query: string;
}) {
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
        </div>
        <a
          href={`tel:${phone.phone}`}
          className="px-3 py-2 bg-primary-600 text-white text-xs rounded hover:bg-primary-700 transition-colors"
        >
          전화
        </a>
      </div>
    </Card>
  );
}

function getScheduleCategoryLabel(category: string): string {
  if (category === "exam") return "시험";
  if (category === "registration") return "수강신청";
  if (category === "holiday") return "휴일";
  return "행사";
}
