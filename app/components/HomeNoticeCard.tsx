"use client";

import Link from "next/link";

import type { HomeNotice } from "@/lib/home";
import type { ServiceNotice } from "@/types";
import { AnnouncementCard } from "./AnnouncementCard";
import { Card } from "./Card";
import { Icon } from "./Icon";
import { useLocale } from "./LocaleProvider";
import { getAnnouncementDetailPath } from "@/lib/announcement-paths";
import { localizePath } from "@/lib/i18n";

interface HomeNoticeCardProps {
  notice: HomeNotice;
}

export function HomeNoticeCard({ notice }: HomeNoticeCardProps) {
  const locale = useLocale();

  if (notice.type === "announcement") {
    return (
      <div key={notice.data.id} className="mb-2">
        <AnnouncementCard
          announcement={notice.data}
          href={localizePath(getAnnouncementDetailPath(notice.data), locale)}
        />
      </div>
    );
  }

  return (
    <div key={notice.data.slug} className="mb-2">
      <ServiceNoticeCard notice={notice.data} />
    </div>
  );
}

export function ServiceNoticeCard({
  notice,
}: {
  notice: ServiceNotice;
}) {
  const locale = useLocale();

  return (
    <Link href={localizePath(`/service/notices/${notice.slug}`, locale)}>
      <Card className="cursor-pointer hover:shadow-card-hover border border-neutral-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="font-semibold text-neutral-900 mb-2">
              {notice.title}
            </h3>
            <p className="text-xs text-neutral-600 line-clamp-2 mb-2">
              {notice.excerpt || ""}
            </p>
            <div className="text-xs text-neutral-500">
              {notice.author} · {notice.date}
            </div>
          </div>
          <Icon
            name="megaphone"
            size={20}
            className="flex-shrink-0"
            color="rgb(82, 82, 82)"
            strokeWidth={1.5}
          />
        </div>
      </Card>
    </Link>
  );
}
