"use client";

import type { Announcement, PhoneNumber } from "@/types";
import type { SearchCategoryItem } from "@/lib/home";
import { AnnouncementCard } from "./AnnouncementCard";
import { Badge } from "./Badge";
import { Card } from "./Card";

interface SearchResultCardProps {
  item: SearchCategoryItem;
}

export function SearchResultCard({ item }: SearchResultCardProps) {
  if ("phone" in item && "department" in item) {
    return <PhoneSearchResultCard phone={item} />;
  }

  if ("startDate" in item) {
    return (
      <Card key={item.id}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h4 className="font-medium text-neutral-900">{item.title}</h4>
            <p className="text-xs text-neutral-600 mt-1">
              {item.startDate}
              {item.startDate !== item.endDate ? ` ~ ${item.endDate}` : ""}
            </p>
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
    <div key={announcement.id}>
      <AnnouncementCard
        announcement={announcement}
        href={announcement.url}
        external={true}
      />
    </div>
  );
}

function PhoneSearchResultCard({ phone }: { phone: PhoneNumber }) {
  return (
    <Card key={phone.phone}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <h4 className="font-medium text-neutral-900">{phone.department}</h4>
          <p className="text-sm text-primary-600 font-semibold mt-1">
            {phone.phone}
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
