"use client";

import Link from "next/link";

import type { HomeNotice } from "@/lib/home";
import type { ServiceNotice } from "@/types";
import { AnnouncementCard } from "./AnnouncementCard";
import { Badge } from "./Badge";
import { formatDateWithYear } from "@/lib/utils";
import { Card } from "./Card";
import { useDictionary, useLocale } from "./LocaleProvider";
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
  const dictionary = useDictionary();
  const translation = useContentTranslation({ kind: "service-notice", id: notice.slug }, notice.lang === "en" ? {} : { title: notice.title, ...(notice.excerpt ? { excerpt: notice.excerpt } : {}) });
  const lang = notice.lang === "en" ? "en" : translation.lang;
  const overlayLabel = `${translation.text("title", notice.title)} ${dictionary.labels.notice}`;

  return (
    <Card as="article" clickable className="relative">
      <Link
        href={localizePath(`/service/notices/${notice.slug}`, locale)}
        prefetch={false}
        className="absolute inset-0 z-10 rounded-card focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        aria-label={overlayLabel}
      >
        <span className="sr-only">{overlayLabel}</span>
      </Link>
      <div className="pointer-events-none relative z-20 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge color="gray" size="sm">{dictionary.home.notices.service}</Badge>
        </div>
        <h3 lang={lang} className="font-semibold text-neutral-900 line-clamp-2">
          {translation.text("title", notice.title)}
        </h3>
        {notice.excerpt && (
          <p lang={lang} className="home-service-notice-excerpt text-xs text-neutral-600 line-clamp-2">
            {translation.text("excerpt", notice.excerpt)}
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-neutral-500 pt-2 border-t border-neutral-100">
          <time dateTime={notice.date} className="shrink-0 whitespace-nowrap tabular-nums">{formatDateWithYear(notice.date)}</time>
          <span lang="ko" translate="no">{notice.author}</span>
        </div>
      </div>
    </Card>
  );
}
