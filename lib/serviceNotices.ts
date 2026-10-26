"use server";

import type { Locale } from "./i18n/routing";
import type { ManagedContentRecord, NoticeOriginalMetadata, PublicManagedPublication } from "@/types/managed-content";
import { getPublicManagedContentRecords, getPublicManagedContentRecord, isVisiblePublication } from "./server/public-managed-content";
import { createPlainTextExcerpt, getServiceNoticePath, getRepositoryServiceNotices, getRepositoryServiceNoticeBySlug, readRepositoryManagedContent } from "./service-notice-repository";
import type { ServiceNotice, ServiceNoticeDetail } from "./service-notice-repository";
export type { ServiceNotice, ServiceNoticeDetail } from "./service-notice-repository";

function databaseOnly() {
  const mode = process.env.SERVICE_NOTICES_SOURCE;
  if (mode && mode !== "hybrid" && mode !== "database") throw new Error("Invalid service notice source mode");
  if (mode === "database" && !process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error("Service notice database is not configured");
  return mode === "database";
}

export async function getRepositoryManagedContent(): Promise<ManagedContentRecord[]> {
  if (databaseOnly()) return [];
  return readRepositoryManagedContent();
}

function noticeSummary(summary: string, content: string, metadata: NoticeOriginalMetadata | undefined, english: boolean) {
  const original = english ? metadata?.english : metadata;
  if (original?.excerpt !== undefined && summary === original.excerpt.slice(0, 300).trim()) return { excerpt: original.excerpt, description: original.description ?? createPlainTextExcerpt(summary || content, 160) };
  return { excerpt: createPlainTextExcerpt(summary || content, 300), description: createPlainTextExcerpt(summary || content, 160) };
}

function managedNotice(record: PublicManagedPublication, locale: Locale, repository?: ServiceNoticeDetail): ServiceNoticeDetail | null {
  if (!isVisiblePublication(record) || record.published?.kind !== "notice") return null;
  const publication = record.published;
  const english = locale === "en" ? publication.english : undefined;
  const matchingRepository = repository && publication.title === repository.title && publication.content === repository.content && publication.summary === repository.excerpt;
  const title = english?.title || publication.title;
  const content = english?.content || publication.content;
  const summary = english?.summary || publication.summary;
  const metadata = record.noticeMetadata;
  const date = metadata?.date ?? repository?.date ?? record.publishedAt;
  if (!date) return null;
  return {
    id: metadata?.publicId ?? repository?.id ?? publication.slug, slug: publication.slug, title,
    content, date, author: metadata?.author ?? repository?.author ?? "SYU CAMPUS",
    lang: english ? "en" : metadata?.lang ?? (matchingRepository ? repository.lang : "ko"),
    startsAt: publication.startsAt, endsAt: publication.endsAt,
    ...(record.publishedUpdatedAt || record.publishedAt ? { modifiedAt: record.publishedUpdatedAt ?? record.publishedAt! } : {}),
    ...noticeSummary(summary, content, metadata, Boolean(english)),
  };
}

export async function getAllServiceNotices(locale: Locale = "ko"): Promise<ServiceNotice[]> {
  const [repository, records] = await Promise.all([databaseOnly() ? [] : getRepositoryServiceNotices(locale), getPublicManagedContentRecords()]);
  const merged = new Map(repository.map(notice => [notice.slug, notice]));
  for (const record of records) {
    if (record.published && record.published.kind !== "notice") continue;
    if (!isVisiblePublication(record) || record.published?.kind !== "notice") { merged.delete(record.id);continue; }
    const original = merged.get(record.id);
    const publication = record.published;
    const english = locale === "en" ? publication.english : undefined;
    const metadata = record.noticeMetadata;
    const date = metadata?.date ?? original?.date ?? record.publishedAt;
    if (!date) { merged.delete(record.id);continue; }
    const title = english?.title || publication.title, summary = english?.summary || publication.summary;
    merged.set(publication.slug, {
      id: metadata?.publicId ?? original?.id ?? publication.slug, slug: publication.slug, title,
      date, author: metadata?.author ?? original?.author ?? "SYU CAMPUS", lang: english ? "en" : metadata?.lang ?? original?.lang ?? "ko",
      ...noticeSummary(summary, title, metadata, Boolean(english)),
      startsAt: publication.startsAt, endsAt: publication.endsAt,
      ...(record.publishedUpdatedAt || record.publishedAt ? { modifiedAt: record.publishedUpdatedAt ?? record.publishedAt! } : {}),
    });
  }
  return [...merged.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getServiceNoticeBySlug(slug: string, locale: Locale = "ko"): Promise<ServiceNoticeDetail | null> {
  if (!getServiceNoticePath(slug)) return null;
  if (databaseOnly()) {
    const record = await getPublicManagedContentRecord(slug);
    return record ? managedNotice(record, locale) : null;
  }
  const [repository, record] = await Promise.all([getRepositoryServiceNoticeBySlug(slug, locale), getPublicManagedContentRecord(slug)]);
  if (!record) return repository;
  const original = locale === "ko" ? repository : await getRepositoryServiceNoticeBySlug(slug);
  const managed = managedNotice(record, locale, original ?? undefined);
  if (managed && locale === "en" && record.published?.kind === "notice" && !record.published.english && original && record.published.title === original.title && record.published.content === original.content && record.published.summary === original.excerpt) {
    return repository ? { ...repository, startsAt: record.published.startsAt, endsAt: record.published.endsAt, ...(record.publishedUpdatedAt || record.publishedAt ? { modifiedAt: record.publishedUpdatedAt ?? record.publishedAt! } : {}) } : null;
  }
  return managed;
}
