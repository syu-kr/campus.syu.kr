"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import type { ContentTranslationSource, PublicContentFields } from "@/lib/content-translation";
import { watchContentTranslation, subscribePageTranslation, getPageTranslationSnapshot, getServerTranslationSnapshot, retryPageTranslation, type TranslationSnapshot } from "@/lib/content-translation-client";
import { useDictionary, useLocale } from "./LocaleContext";
import { buttonStyles } from "./Button";

export function useContentTranslation(source: ContentTranslationSource, original: PublicContentFields) {
  const locale = useLocale();
  const key = JSON.stringify([source, original]);
  const [result, setResult] = useState<{ key: string; snapshot: TranslationSnapshot } | null>(null);
  useEffect(() => {
    if (locale !== "en") return;
    let active = true;
    const [descriptor, fields] = JSON.parse(key) as [ContentTranslationSource, PublicContentFields];
    const stop = watchContentTranslation(descriptor, fields, snapshot => { if (active) setResult({ key, snapshot }); });
    return () => { active = false; stop(); };
  }, [key, locale]);
  const current = locale === "en" && result?.key === key ? result.snapshot : null;
  const translated = Boolean(current?.fields && Object.keys(current.fields).length);
  return {
    text: (field: string, fallback: string) => current?.fields?.[field] ?? fallback,
    lang: translated ? "en-x-mtfrom-ko" : Object.values(original).some(value => /\p{Script=Hangul}/u.test(value)) ? "ko" : "en",
    translated, controls: null,
    status: current?.status ?? "idle",
  };
}

/** Render public translations at their existing React text positions. */
export function PublicContentTranslation({ source, content, children }: { source: ContentTranslationSource; content: PublicContentFields; children?: ReactNode | ((translation: ReturnType<typeof useContentTranslation>) => ReactNode) }) {
  const translation = useContentTranslation(source, content);
  return typeof children === "function" ? children(translation) : children ?? null;
}

/** One page-level attribution and recovery control replaces per-item buttons. */
export function PageTranslationStatus() {
  const locale = useLocale(), dictionary = useDictionary().contentTranslation;
  const state = useSyncExternalStore(subscribePageTranslation, getPageTranslationSnapshot, getServerTranslationSnapshot);
  if (locale !== "en" || (!state.loading && !state.translated && !state.error)) return null;
  return <aside className="m3-page-translation" aria-label={dictionary.pageLabel}>
    <a className="m3-translation-attribution" href="https://translate.google.com/" target="_blank" rel="noopener noreferrer">
      <Image src="/brand/google-translate/powered-by-google-translate.png" width={176} height={16} unoptimized alt="Powered by Google Translate" />
    </a>
    <p role="status">{state.error ? dictionary[state.error as "error" | "unavailable" | "limited" | "changed"] : state.loading ? dictionary.pageLoading : dictionary.machineTranslated}</p>
    {state.error && state.error !== "changed" && <button type="button" className={buttonStyles("ghost")} onClick={retryPageTranslation}>{dictionary.retry}</button>}
  </aside>;
}
