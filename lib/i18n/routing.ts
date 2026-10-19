export const LOCALES = ["ko", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ko";
export const ENGLISH_LOCALE: Locale = "en";
export const LOCALE_COOKIE_NAME = "syu-campus-locale";
export const LOCALE_HEADER_NAME = "x-syu-locale";
export const PATHNAME_HEADER_NAME = "x-syu-pathname";

export const localeLabels: Record<Locale, string> = {
  ko: "대한민국 (한국어)",
  en: "Global (English)",
};

export function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function normalizeLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function getLocaleFromPathname(pathname: string): Locale {
  return pathname === "/en" || pathname.startsWith("/en/")
    ? ENGLISH_LOCALE
    : DEFAULT_LOCALE;
}

export function stripLocalePrefix(pathname: string): string {
  if (pathname === "/en") return "/";
  if (pathname.startsWith("/en/")) return pathname.slice(3) || "/";
  return pathname || "/";
}

function normalizeCanonicalPathname(pathname: string): string {
  return pathname === "/index" ? "/" : pathname;
}

export function localizePath(href: string, locale: Locale): string {
  if (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("#")
  ) {
    return href;
  }

  if (!href.startsWith("/")) {
    return href;
  }

  const hashIndex = href.indexOf("#");
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const queryIndex = withoutHash.indexOf("?");
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex) : "";
  const pathname =
    queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const strippedPathname = stripLocalePrefix(pathname);
  const localizedPathname =
    locale === ENGLISH_LOCALE
      ? strippedPathname === "/"
        ? "/en"
        : `/en${strippedPathname}`
      : strippedPathname;

  return `${localizedPathname}${query}${hash}`;
}

export function createLocalizedAlternates(pathname: string, locale: Locale) {
  const koreanPath = normalizeCanonicalPathname(stripLocalePrefix(pathname));

  return {
    canonical: localizePath(koreanPath, locale),
    languages: {
      ko: koreanPath,
      en: localizePath(koreanPath, ENGLISH_LOCALE),
      "x-default": koreanPath,
    },
  };
}
