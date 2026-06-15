"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

import {
  LOCALE_COOKIE_NAME,
  LOCALES,
  localeLabels,
  localizePath,
  type Locale,
} from "@/lib/i18n";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function LanguageSelector() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const locale = useLocale();
  const dictionary = useDictionary();

  const handleChange = (nextLocale: Locale) => {
    const query = searchParams.toString();
    const href = `${pathname}${query ? `?${query}` : ""}`;

    document.cookie = [
      `${LOCALE_COOKIE_NAME}=${nextLocale}`,
      "path=/",
      `max-age=${LOCALE_COOKIE_MAX_AGE}`,
      "SameSite=Lax",
    ].join("; ");

    router.push(localizePath(href, nextLocale));
    router.refresh();
  };

  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-600 sm:text-sm">
      <span className="font-medium text-neutral-700">
        {dictionary.footer.countrySetting}
      </span>
      <select
        value={locale}
        onChange={(event) => handleChange(event.target.value as Locale)}
        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none transition-colors focus:border-primary-500 sm:w-48"
      >
        {LOCALES.map((item) => (
          <option key={item} value={item}>
            {localeLabels[item]}
          </option>
        ))}
      </select>
    </label>
  );
}
