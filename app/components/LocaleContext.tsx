"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { Dictionary } from "@/lib/i18n";
import { koDictionary } from "@/lib/i18n/ko";
import { DEFAULT_LOCALE, normalizeLocale, type Locale } from "@/lib/i18n/routing";

interface LocaleContextValue {
  locale: Locale;
  dictionary: Dictionary;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  dictionary: koDictionary,
});

export function ClientLocaleProvider({
  children,
  locale,
  dictionary = koDictionary,
}: {
  children: ReactNode;
  locale: Locale;
  dictionary?: Dictionary;
}) {
  const value = useMemo(() => ({
    locale: normalizeLocale(locale),
    dictionary,
  }), [locale, dictionary]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

export function useDictionary(): Dictionary {
  return useContext(LocaleContext).dictionary;
}
