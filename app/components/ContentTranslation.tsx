"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ContentTranslationSource, PublicContentFields } from "@/lib/content-translation";
import { watchContentTranslation, subscribePageTranslation, getPageTranslationSnapshot, getServerTranslationSnapshot, retryPageTranslation, type TranslationSnapshot } from "@/lib/content-translation-client";
import { useDictionary, useLocale } from "./LocaleContext";
import { buttonStyles } from "./Button";

export function useContentTranslation(source: ContentTranslationSource, original: PublicContentFields, enabled = true) {
  const locale = useLocale();
  const key = JSON.stringify([source, original]);
  const [result, setResult] = useState<{ key: string; snapshot: TranslationSnapshot } | null>(null);
  useEffect(() => {
    if (locale !== "en" || !enabled) return;
    let active = true;
    const [descriptor, fields] = JSON.parse(key) as [ContentTranslationSource, PublicContentFields];
    const stop = watchContentTranslation(descriptor, fields, snapshot => { if (active) setResult({ key, snapshot }); });
    return () => { active = false; stop(); };
  }, [key, locale, enabled]);
  const current = locale === "en" && result?.key === key ? result.snapshot : null;
  const translated = Boolean(current?.fields && Object.keys(current.fields).length);
  return {
    text: (field: string, fallback: string) => current?.fields?.[field] ?? fallback,
    lang: translated ? "en-x-mtfrom-ko" : Object.values(original).some(value => /\p{Script=Hangul}/u.test(value)) ? "ko" : "en",
    translated, controls: null,
    status: current?.status ?? "idle",
    retry: () => retryPageTranslation(source),
  };
}

/** Render public translations at their existing React text positions. */
export function PublicContentTranslation({ source, content, children }: { source: ContentTranslationSource; content: PublicContentFields; children?: ReactNode | ((translation: ReturnType<typeof useContentTranslation>) => ReactNode) }) {
  const translation = useContentTranslation(source, content);
  return typeof children === "function" ? children(translation) : children ?? null;
}

/** Page recovery stays global; modals pass their own translation to isolate errors. */
export function PageTranslationStatus({ translation }: { translation?: ReturnType<typeof useContentTranslation> } = {}) {
  const statusRef = useRef<HTMLParagraphElement>(null);
  const pathname = usePathname();
  const reserveSpace = !translation && (pathname === "/" || pathname === "/en" || pathname === "/en/");
  const locale = useLocale(), dictionary = useDictionary().contentTranslation;
  const pageState = useSyncExternalStore(subscribePageTranslation, getPageTranslationSnapshot, getServerTranslationSnapshot);
  const state = translation ? {
    loading: translation.status === "loading", translated: translation.translated,
    error: ["idle", "loading"].includes(translation.status) ? null : translation.status,
  } : pageState;
  const active = state.loading || state.translated || Boolean(state.error);
  if (locale !== "en" || (!active && !reserveSpace)) return null;
  return <aside className="m3-page-translation" aria-label={dictionary.pageLabel} aria-hidden={!active || undefined} style={{ visibility: active ? undefined : "hidden" }}>
    <a className="m3-translation-attribution" href="https://translate.google.com/" target="_blank" rel="noopener noreferrer">
      <Image src="/brand/google-translate/powered-by-google-translate.png" width={176} height={16} unoptimized alt="Powered by Google Translate" />
    </a>
    <p ref={statusRef} role="status" tabIndex={-1} className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600">{state.error ? dictionary[state.error as "error" | "unavailable" | "limited" | "changed"] : state.loading || !active ? dictionary.pageLoading : dictionary.machineTranslated}</p>
    {state.error && state.error !== "changed" && <button type="button" className={buttonStyles("ghost")} onClick={() => { statusRef.current?.focus({ preventScroll: true }); if (translation) translation.retry(); else retryPageTranslation(); }}>{dictionary.retry}</button>}
  </aside>;
}
