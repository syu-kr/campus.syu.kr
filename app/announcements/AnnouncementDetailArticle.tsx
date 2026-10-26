"use client";

import { Badge } from "@/app/components/Badge";
import { useDictionary } from "@/app/components/LocaleProvider";
import { useContentTranslation } from "@/app/components/ContentTranslation";
import { announcementTranslationFields, splitPublicContentText } from "@/lib/content-translation";
import { formatDateWithYear, getCategoryColor, getCategoryLabel } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/routing";
import type { Announcement } from "@/types";

export function AnnouncementDetailArticle({ announcement, locale }: { announcement: Announcement; locale: Locale }) {
  const dictionary = useDictionary(), text = dictionary.pages.announcements, aiLabels = dictionary.labels.aiSummaryDetails;
  const parts = splitPublicContentText(announcement.content || "");
  const translation = useContentTranslation({ kind: "announcement", id: announcement.id, category: announcement.category }, { ...announcementTranslationFields(announcement), ...Object.fromEntries(parts.map((part, index) => [`contentParts.${index}`, part])) });
  const detail = (field: "summary" | "target" | "deadline" | "requiredAction") => {
    const value = formatAiDetail(announcement.aiSummary?.[field] ?? "", aiLabels.empty);
    return value === aiLabels.empty ? value : translation.text(`aiSummary.${field}`, value);
  };
  return (
            <article>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge color={getCategoryColor(announcement.category)} size="sm">
                  {getCategoryLabel(announcement.category, dictionary.categories)}
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

              <h1 lang={translation.lang} className="mb-4 text-2xl font-bold leading-tight text-neutral-900 md:text-3xl">
                {translation.text("title", announcement.title)}
              </h1>

              <dl className="mb-6 flex flex-wrap items-center gap-3 border-b border-neutral-200 pb-4 text-sm text-neutral-600">
                <MetaItem label={text.author} value={announcement.author} lang="ko" />
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
                  <p lang={detail("summary") === aiLabels.empty ? locale : translation.lang} className="mt-2 text-sm leading-6 text-neutral-700">
                    {detail("summary")}
                  </p>

                  <dl className="mt-4 grid gap-3 md:grid-cols-3">
                    <AiDetailItem
                      label={aiLabels.fields.target}
                      empty={aiLabels.empty}
                      locale={locale}
                      lang={translation.lang}
                      value={detail("target")}
                    />
                    <AiDetailItem
                      label={aiLabels.fields.deadline}
                      empty={aiLabels.empty}
                      locale={locale}
                      lang={translation.lang}
                      value={detail("deadline")}
                    />
                    <AiDetailItem
                      label={aiLabels.fields.requiredAction}
                      empty={aiLabels.empty}
                      locale={locale}
                      lang={translation.lang}
                      value={detail("requiredAction")}
                    />
                  </dl>

                  {announcement.aiSummary.keywords.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-xs font-semibold text-neutral-600">
                        {aiLabels.fields.keywords}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {announcement.aiSummary.keywords.map((keyword, index) => (
                          <span
                            key={keyword}
                            lang={translation.lang}
                            className="rounded-md bg-white px-2 py-1 text-xs font-medium text-neutral-700"
                          >
                            {translation.text(`aiSummary.keywords.${index}`, keyword)}
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

              <div lang={announcement.content ? translation.lang : locale} className="whitespace-pre-wrap text-base leading-8 text-neutral-800">
                {parts.length ? parts.map((part, index) => translation.text(`contentParts.${index}`, part)).join("") : text.detailContentFallback}
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
  );
}

function MetaItem({ label, value, lang }: { label: string; value: string; lang?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <dt>{label}</dt>
      <dd lang={lang} translate={lang ? "no" : undefined} className="font-medium text-neutral-900">{value}</dd>
    </div>
  );
}

function AiDetailItem({ label, value, empty, locale, lang }: { label: string; value: string; empty: string; locale: string; lang: string }) {
  return (
    <div className="rounded-lg bg-white/85 px-3 py-2">
      <dt className="text-xs font-semibold text-neutral-500">{label}</dt>
      <dd lang={value === empty ? locale : lang} className="mt-1 text-sm leading-6 text-neutral-800">{value}</dd>
    </div>
  );
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
