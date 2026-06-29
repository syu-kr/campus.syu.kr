import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/app/components/Badge";
import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { StructuredDataScript } from "@/app/components/StructuredDataScript";
import {
  getAnnouncementById,
} from "@/lib/server/announcements";
import {
  LOCALE_HEADER_NAME,
  getDictionary,
  localizePath,
  normalizeLocale,
} from "@/lib/i18n";
import { createArticleSchema } from "@/lib/structured-data";
import {
  formatDateWithYear,
  getCategoryColor,
  getCategoryLabel,
} from "@/lib/utils";
import type { Announcement, AnnouncementCategory } from "@/types";

interface AnnouncementDetailPageProps {
  params: Promise<{
    category: string;
    id: string;
  }>;
}

export const runtime = "nodejs";

const CSP_NONCE_HEADER_NAME = "x-csp-nonce";
const SITE_ORIGIN = "https://campus.syu.kr";
const VALID_CATEGORIES: AnnouncementCategory[] = [
  "academic",
  "campus",
  "scholarship",
];

async function getRequestContext() {
  const headerStore = await headers();

  return {
    locale: normalizeLocale(headerStore.get(LOCALE_HEADER_NAME)),
    nonce: headerStore.get(CSP_NONCE_HEADER_NAME) || undefined,
  };
}

export async function generateMetadata({
  params,
}: AnnouncementDetailPageProps): Promise<Metadata> {
  const { category, id } = await params;
  const locale = (await getRequestContext()).locale;
  const text = getDictionary(locale).pages.announcements;
  const normalizedCategory = normalizeAnnouncementCategory(category);
  const announcement = normalizedCategory
    ? await getAnnouncementById(normalizedCategory, id)
    : null;

  if (!announcement) {
    return {
      title: text.detailFallbackTitle,
      description: text.detailFallbackDescription,
    };
  }

  const description =
    announcement.aiSummary?.summary ||
    announcement.content ||
    text.detailFallbackDescription;
  const detailPath = getAnnouncementDetailPath(announcement);

  return {
    title: `${announcement.title} | SYU CAMPUS`,
    description,
    alternates: {
      canonical: localizePath(detailPath, locale),
    },
    openGraph: {
      title: `${announcement.title} | SYU CAMPUS`,
      description,
      type: "article",
      url: `${SITE_ORIGIN}${localizePath(detailPath, locale)}`,
    },
  };
}

export default async function AnnouncementDetailPage({
  params,
}: AnnouncementDetailPageProps) {
  const { category, id } = await params;
  const { locale, nonce } = await getRequestContext();
  const normalizedCategory = normalizeAnnouncementCategory(category);

  if (!normalizedCategory) notFound();

  const announcement = await getAnnouncementById(normalizedCategory, id);
  if (!announcement) notFound();

  const dictionary = getDictionary(locale);
  const text = dictionary.pages.announcements;
  const aiLabels = dictionary.labels.aiSummaryDetails;
  const detailPath = getAnnouncementDetailPath(announcement);
  const detailUrl = `${SITE_ORIGIN}${localizePath(detailPath, locale)}`;
  const articleDescription =
    announcement.aiSummary?.summary ||
    announcement.content ||
    text.detailFallbackDescription;

  return (
    <>
      <StructuredDataScript
        id="announcement-article-schema"
        nonce={nonce}
        data={createArticleSchema({
          authorName:
            announcement.author || dictionary.labels.sahmyookUniversity,
          datePublished: toIsoDate(announcement.date),
          description: articleDescription,
          headline: announcement.title,
          inLanguage: dictionary.meta.inLanguage,
          keywords: announcement.aiSummary?.keywords,
          url: detailUrl,
        })}
      />
      <Container>
        <div className="py-6 md:py-8">
          <Link
            href={localizePath(getAnnouncementListPath(announcement), locale)}
            prefetch={false}
            className="mb-6 inline-flex items-center gap-2 font-medium text-primary-600 transition-colors hover:text-primary-700"
          >
            <span aria-hidden="true">←</span>
            {text.backToList}
          </Link>

          <Card className="mb-6 md:mb-8" hover={false}>
            <article>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge color={getCategoryColor(announcement.category)} size="sm">
                  {getCategoryLabel(announcement.category, locale)}
                </Badge>
                {announcement.isPinned && (
                  <Badge color="red" size="sm">
                    {dictionary.labels.pinned}
                  </Badge>
                )}
                {announcement.isImportant && (
                  <Badge color="red" size="sm">
                    {dictionary.labels.notice}
                  </Badge>
                )}
              </div>

              <h1 className="mb-4 text-2xl font-bold leading-tight text-neutral-900 md:text-3xl">
                {announcement.title}
              </h1>

              <dl className="mb-6 flex flex-wrap items-center gap-3 border-b border-neutral-200 pb-4 text-sm text-neutral-600">
                <MetaItem label={text.author} value={announcement.author} />
                <MetaItem
                  label={text.date}
                  value={formatDateWithYear(announcement.date)}
                />
                <MetaItem
                  label={text.views}
                  value={announcement.views.toLocaleString(
                    locale === "ko" ? "ko-KR" : "en-US",
                  )}
                />
              </dl>

              {announcement.aiSummary && (
                <section className="mb-6 rounded-lg border border-primary-100 bg-primary-50/70 p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge color="blue" size="sm">
                      {dictionary.labels.aiSummary}
                    </Badge>
                    <Badge
                      color={getAiImportanceColor(
                        announcement.aiSummary.importance,
                      )}
                      size="sm"
                    >
                      {
                        dictionary.labels.aiImportance[
                          announcement.aiSummary.importance
                        ]
                      }
                    </Badge>
                  </div>
                  <h2 className="text-base font-bold text-neutral-900">
                    {text.aiInsightTitle}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-neutral-700">
                    {formatAiDetail(
                      announcement.aiSummary.summary,
                      aiLabels.empty,
                    )}
                  </p>

                  <dl className="mt-4 grid gap-3 md:grid-cols-3">
                    <AiDetailItem
                      label={aiLabels.fields.target}
                      value={formatAiDetail(
                        announcement.aiSummary.target,
                        aiLabels.empty,
                      )}
                    />
                    <AiDetailItem
                      label={aiLabels.fields.deadline}
                      value={formatAiDetail(
                        announcement.aiSummary.deadline,
                        aiLabels.empty,
                      )}
                    />
                    <AiDetailItem
                      label={aiLabels.fields.requiredAction}
                      value={formatAiDetail(
                        announcement.aiSummary.requiredAction,
                        aiLabels.empty,
                      )}
                    />
                  </dl>

                  {announcement.aiSummary.keywords.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-xs font-semibold text-neutral-600">
                        {aiLabels.fields.keywords}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {announcement.aiSummary.keywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="rounded-md bg-white px-2 py-1 text-xs font-medium text-neutral-700"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="mt-4 border-t border-primary-100 pt-3 text-xs leading-5 text-neutral-600">
                    {text.sourceNotice}
                  </p>
                </section>
              )}

              <div className="whitespace-pre-wrap text-base leading-8 text-neutral-800">
                {announcement.content || text.detailContentFallback}
              </div>

              {announcement.url && (
                <div className="mt-8 border-t border-neutral-200 pt-5">
                  <a
                    href={announcement.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
                  >
                    {text.originalLink}
                  </a>
                </div>
              )}
            </article>
          </Card>
        </div>
      </Container>
    </>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <dt>{label}</dt>
      <dd className="font-medium text-neutral-900">{value}</dd>
    </div>
  );
}

function AiDetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/85 px-3 py-2">
      <dt className="text-xs font-semibold text-neutral-500">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-neutral-800">{value}</dd>
    </div>
  );
}

function normalizeAnnouncementCategory(
  value: string,
): AnnouncementCategory | null {
  return VALID_CATEGORIES.includes(value as AnnouncementCategory)
    ? (value as AnnouncementCategory)
    : null;
}

function getAnnouncementDetailPath(announcement: Announcement) {
  return `/announcements/${announcement.category}/${encodeURIComponent(
    announcement.id,
  )}`;
}

function getAnnouncementListPath(announcement: Announcement) {
  if (announcement.category === "academic") return "/academic/announcements";
  if (announcement.category === "campus") return "/campus/announcements";
  return "/announcements";
}

function formatAiDetail(value: string, fallback: string) {
  const normalized = value.trim();

  if (!normalized || normalized.toLowerCase() === "unknown") {
    return fallback;
  }

  return normalized;
}

function getAiImportanceColor(
  importance: NonNullable<Announcement["aiSummary"]>["importance"],
): "red" | "yellow" | "gray" {
  if (importance === "high") return "red";
  if (importance === "normal") return "yellow";
  return "gray";
}

function toIsoDate(value: string) {
  const normalized = value.replace(/\./g, "-");
  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
