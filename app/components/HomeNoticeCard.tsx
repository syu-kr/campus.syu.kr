"use client";

import Link from "next/link";

import type { HomeNotice } from "@/lib/home";
import type { ServiceNotice } from "@/types";
import { AnnouncementCard } from "./AnnouncementCard";
import { Card } from "./Card";
import { Icon } from "./Icon";
import { useLocale } from "./LocaleProvider";
import { localizePath } from "@/lib/i18n";
import { useContentTranslation } from "./ContentTranslation";

interface HomeNoticeCardProps {
  notice: HomeNotice;
}

export function HomeNoticeCard({ notice }: HomeNoticeCardProps) {
  if (notice.type === "announcement") {
    return (
      <div key={notice.data.id} className="mb-2">
        <AnnouncementCard
          announcement={notice.data}
          aiSummaryMode="preview"
          href={notice.data.url}
          external={Boolean(notice.data.url)}
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
  const translation = useContentTranslation({ kind: "service-notice", id: notice.slug }, notice.lang === "en" ? {} : { title: notice.title, ...(notice.excerpt ? { excerpt: notice.excerpt } : {}) });
  const lang = notice.lang === "en" ? "en" : translation.lang;

  return (
    <Link href={localizePath(`/service/notices/${notice.slug}`, locale)}>
      <Card className="cursor-pointer hover:shadow-card-hover border border-neutral-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 lang={lang} className="font-semibold text-neutral-900 mb-2">
              {translation.text("title", notice.title)}
            </h3>
            <p lang={lang} className="text-xs text-neutral-600 line-clamp-2 mb-2">
              {translation.text("excerpt", notice.excerpt || "")}
            </p>
            <div lang="ko" translate="no" className="text-xs text-neutral-500">
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
