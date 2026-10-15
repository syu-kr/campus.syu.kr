"use client";

import type { AnswerSource } from "@/types";
import { useDictionary } from "./LocaleProvider";

export function SourceAttribution({ sources }: {
  sources: AnswerSource[];
}) {
  const text = useDictionary().answerSummary;

  return (
    <footer className="mt-8 border-t border-neutral-200 pt-4 text-xs leading-5 text-neutral-500">
      <p className="mb-1 font-medium">{text.sourceLabel}</p>
      <ul aria-label={text.sourceLabel} className="space-y-2">
        {sources.map((source, index) => (
          <li key={`${source.url}-${index}`}>
            {isHttpsUrl(source.url) ? (
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="rounded underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">{source.name}</a>
            ) : <span>{source.name}</span>}
            {source.note && <p>{source.note}</p>}
          </li>
        ))}
      </ul>
    </footer>
  );
}

function isHttpsUrl(value: string) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
