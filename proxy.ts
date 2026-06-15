import { NextResponse, type NextRequest } from "next/server";

import {
  DEFAULT_LOCALE,
  ENGLISH_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_HEADER_NAME,
  PATHNAME_HEADER_NAME,
  getLocaleFromPathname,
  isLocale,
  localizePath,
  stripLocalePrefix,
  type Locale,
} from "@/lib/i18n";

const PUBLIC_FILE_PATTERN = /\/[^/]+\.[^/]+$/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldSkipLocaleProxy(pathname)) {
    return NextResponse.next();
  }

  const pathLocale = getLocaleFromPathname(pathname);

  if (pathLocale === ENGLISH_LOCALE) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = stripLocalePrefix(pathname);
    return rewriteWithLocale(request, rewriteUrl, ENGLISH_LOCALE);
  }

  const preferredLocale = getPreferredLocale(request);
  if (preferredLocale === ENGLISH_LOCALE) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = localizePath(pathname, ENGLISH_LOCALE);
    return NextResponse.redirect(redirectUrl);
  }

  return nextWithLocale(request, DEFAULT_LOCALE);
}

function shouldSkipLocaleProxy(pathname: string) {
  return (
    pathname.startsWith("/api/") ||
    pathname === "/api" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/data/") ||
    PUBLIC_FILE_PATTERN.test(pathname)
  );
}

function getPreferredLocale(request: NextRequest): Locale {
  const country = getRequestCountry(request);
  if (country && country !== "KR") {
    return ENGLISH_LOCALE;
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (isLocale(cookieLocale)) {
    return cookieLocale;
  }

  return DEFAULT_LOCALE;
}

function getRequestCountry(request: NextRequest): string | null {
  return (
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-country-code")
  )?.toUpperCase() ?? null;
}

function nextWithLocale(request: NextRequest, locale: Locale) {
  const requestHeaders = getLocaleHeaders(request, locale);
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

function rewriteWithLocale(
  request: NextRequest,
  rewriteUrl: URL,
  locale: Locale,
) {
  const requestHeaders = getLocaleHeaders(request, locale);
  return NextResponse.rewrite(rewriteUrl, {
    request: {
      headers: requestHeaders,
    },
  });
}

function getLocaleHeaders(request: NextRequest, locale: Locale) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER_NAME, locale);
  requestHeaders.set(PATHNAME_HEADER_NAME, request.nextUrl.pathname);
  return requestHeaders;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
