"use client";

import { usePathname, useSearchParams } from "next/navigation";

import {
  LOCALE_COOKIE_NAME,
  LOCALES,
  isLocale,
  localeLabels,
  localizePath,
  type Locale,
} from "@/lib/i18n/routing";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { M3Select } from "@/app/components/M3Select";
import "./locale-selector.css";

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function LanguageSelector() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const locale = useLocale();
  const dictionary = useDictionary();

  const handleChange = (nextLocale: Locale) => {
    if (nextLocale === locale) return;

    const destination = new URL(window.location.origin);
    destination.pathname = localizePath(pathname, nextLocale);
    destination.search = searchParams.toString();
    destination.hash = window.location.hash;

    document.cookie = [
      `${LOCALE_COOKIE_NAME}=${nextLocale}`,
      "path=/",
      `max-age=${LOCALE_COOKIE_MAX_AGE}`,
      "SameSite=Lax",
    ].join("; ");

    // shortcut: reloading the root locale clears client drafts; replace only after safe RSC switching is verified.
    window.location.assign(destination.href);
  };

  return (
    <div className="m3-locale-selector flex flex-col gap-1 text-xs text-neutral-600 sm:text-sm">
      <label id="footer-locale-label" htmlFor="footer-locale" className="font-medium text-neutral-700">
        {dictionary.footer.countrySetting}
      </label>
      <M3Select
        id="footer-locale"
        value={locale}
        onValueChange={(value) => { if (isLocale(value)) handleChange(value); }}
        options={LOCALES.map((value) => ({ value, label: localeLabels[value] }))}
      />
    </div>
  );
}
