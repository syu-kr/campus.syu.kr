import type { ReactNode } from "react";

import { enDictionary } from "@/lib/i18n/en";
import { normalizeLocale, type Locale } from "@/lib/i18n/routing";
import { ClientLocaleProvider } from "./LocaleContext";

export { useDictionary, useLocale } from "./LocaleContext";

export function LocaleProvider({
  children,
  locale,
}: {
  children: ReactNode;
  locale: Locale;
}) {
  const normalizedLocale = normalizeLocale(locale);

  return (
    <ClientLocaleProvider
      locale={normalizedLocale}
      dictionary={normalizedLocale === "en" ? enDictionary : undefined}
    >
      {children}
    </ClientLocaleProvider>
  );
}
