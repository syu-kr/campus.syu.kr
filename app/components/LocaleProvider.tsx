"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import {
  DEFAULT_LOCALE,
  dictionaries,
  getDictionary,
  normalizeLocale,
  type Dictionary,
  type Locale,
} from "@/lib/i18n";

interface LocaleContextValue {
  locale: Locale;
  dictionary: Dictionary;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  dictionary: dictionaries[DEFAULT_LOCALE],
});

export function LocaleProvider({
  children,
  locale,
}: {
  children: ReactNode;
  locale: Locale;
}) {
  const value = useMemo(() => {
    const normalizedLocale = normalizeLocale(locale);

    return {
      locale: normalizedLocale,
      dictionary: getDictionary(normalizedLocale),
    };
  }, [locale]);

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

export function useDictionary(): Dictionary {
  return useContext(LocaleContext).dictionary;
}
