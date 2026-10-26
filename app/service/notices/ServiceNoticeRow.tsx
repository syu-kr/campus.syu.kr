"use client";

import Link from "next/link";
import type { ServiceNotice } from "@/lib/serviceNotices";
import { useContentTranslation } from "@/app/components/ContentTranslation";

export function ServiceNoticeRow({ notice, href, date, dateLabel }: { notice: ServiceNotice; href: string; date: string; dateLabel: string }) {
  const translation = useContentTranslation({ kind: "service-notice", id: notice.slug }, notice.lang === "en" ? {} : { title: notice.title, ...(notice.excerpt ? { excerpt: notice.excerpt } : {}) });
  const lang = notice.lang === "en" ? "en" : translation.lang;
  return <li>
    <Link href={href} prefetch={false} className="service-notice-row">
      <time className="service-notice-date" dateTime={notice.date} aria-label={`${dateLabel} ${date}`}>{date}</time>
      <div className="service-notice-copy">
        <h2 lang={lang} className="line-clamp-2">{translation.text("title", notice.title)}</h2>
        {notice.excerpt && <p lang={lang} className="service-notice-excerpt line-clamp-2">{translation.text("excerpt", notice.excerpt)}</p>}
        <span lang="ko" translate="no" className="service-notice-author">{notice.author}</span>
      </div>
      <span className="service-notice-arrow" aria-hidden="true"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" focusable="false"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></span>
    </Link>
  </li>;
}
