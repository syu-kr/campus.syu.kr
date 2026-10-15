"use client";

import type { AnswerSource, AnswerSummary } from "@/types";
import { localizePath } from "@/lib/i18n";
import { createFAQPageSchema } from "@/lib/structured-data";
import { useDictionary, useLocale } from "./LocaleProvider";
import { Card } from "./Card";
import { StructuredDataScript } from "./StructuredDataScript";

type AnswerSummarySectionProps = {
  summary: AnswerSummary;
  sources: AnswerSource[];
  schemaId: string;
  path: string;
  basisAt: string;
  nonce?: string;
};

export function AnswerSummarySection({
  summary, sources, schemaId, path, basisAt, nonce,
}: AnswerSummarySectionProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.answerSummary;
  const formatter = new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul", timeZoneName: "short",
  });
  const basisTime = Date.parse(basisAt);
  const citationUrls = sources.map(({ url }) => url).filter(isHttpsUrl);

  return (
    <>
      <Card as="section" hover={false} className="mb-6 border border-neutral-200" aria-labelledby={`${schemaId}-title`}>
        <h2 id={`${schemaId}-title`} className="text-lg font-bold text-neutral-900">{summary.title}</h2>
        <p className="mt-2 text-sm font-medium text-neutral-700">{summary.question}</p>
        <p data-answer-text className="mt-2 whitespace-pre-line text-sm leading-6 text-neutral-800">{summary.answer}</p>
        <ul aria-label={text.sourceLabel} className="mt-4 space-y-3 border-t border-neutral-100 pt-3 text-xs leading-5 text-neutral-600">
          {sources.map((source, index) => {
            const checkedTime = source.checkedAt ? Date.parse(source.checkedAt) : NaN;
            const hasCheckedTime = Boolean(source.checkedAt && /(?:Z|[+-]\d{2}:\d{2})$/.test(source.checkedAt))
              && Number.isFinite(checkedTime) && checkedTime <= basisTime;
            return (
              <li key={`${source.url}-${index}`}>
                {text.sourceLabel}: {isHttpsUrl(source.url) ? (
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="rounded underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">{source.name}</a>
                ) : <span>{source.name}</span>}
                <p>{text.checkedAtLabel}: {hasCheckedTime ? (
                  <time dateTime={source.checkedAt!}>{formatter.format(checkedTime)}</time>
                ) : text.unknownCheckedAt}</p>
                {source.note && <p>{source.note}</p>}
              </li>
            );
          })}
        </ul>
        {Number.isFinite(basisTime) && <p className="mt-3 text-xs text-neutral-500">{text.basisLabel}: <time dateTime={basisAt}>{formatter.format(basisTime)}</time></p>}
        <p className="mt-2 text-xs leading-5 text-neutral-500">{text.unofficialNotice}</p>
      </Card>
      <StructuredDataScript id={schemaId} nonce={nonce} data={createFAQPageSchema({
        inLanguage: dictionary.meta.inLanguage,
        url: `https://campus.syu.kr${localizePath(path, locale)}`,
        mainEntity: [{ questionName: summary.question, acceptedAnswerText: summary.answer, citationUrls }],
      })} />
    </>
  );
}

function isHttpsUrl(value: string) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
