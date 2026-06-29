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
const CSP_NONCE_HEADER_NAME = "x-csp-nonce";
const isProduction = process.env.NODE_ENV === "production";

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
  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (isLocale(cookieLocale)) {
    return cookieLocale;
  }

  return DEFAULT_LOCALE;
}

function nextWithLocale(request: NextRequest, locale: Locale) {
  const nonce = createNonce();
  const requestHeaders = getLocaleHeaders(request, locale, nonce);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  return withContentSecurityPolicy(response, nonce);
}

function rewriteWithLocale(
  request: NextRequest,
  rewriteUrl: URL,
  locale: Locale,
) {
  const nonce = createNonce();
  const requestHeaders = getLocaleHeaders(request, locale, nonce);
  const response = NextResponse.rewrite(rewriteUrl, {
    request: {
      headers: requestHeaders,
    },
  });

  return withContentSecurityPolicy(response, nonce);
}

function getLocaleHeaders(
  request: NextRequest,
  locale: Locale,
  nonce: string,
) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER_NAME, locale);
  requestHeaders.set(PATHNAME_HEADER_NAME, request.nextUrl.pathname);
  requestHeaders.set(CSP_NONCE_HEADER_NAME, nonce);
  return requestHeaders;
}

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function withContentSecurityPolicy(response: NextResponse, nonce: string) {
  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));
  return response;
}

function buildContentSecurityPolicy(nonce: string) {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    !isProduction ? "'unsafe-eval'" : "",
    "https://www.googletagmanager.com",
    "https://www.gstatic.com",
    "https://apis.google.com",
    "https://dapi.kakao.com",
    "https://t1.daumcdn.net",
    !isProduction ? "http://t1.daumcdn.net" : "",
  ].filter(Boolean);

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    [
      "img-src",
      "'self'",
      "data:",
      "blob:",
      "https://www.googletagmanager.com",
      "https://*.googleusercontent.com",
      "https://*.gstatic.com",
      "https://*.daumcdn.net",
      "https://*.kakaocdn.net",
      "https://t1.daumcdn.net",
      !isProduction ? "http://*.daumcdn.net" : "",
    ].filter(Boolean).join(" "),
    [
      "connect-src",
      "'self'",
      !isProduction ? "webpack:" : "",
      "https://www.google-analytics.com",
      "https://*.google-analytics.com",
      "https://region1.google-analytics.com",
      "https://analytics.google.com",
      "https://*.googleapis.com",
      "https://firebaseinstallations.googleapis.com",
      "https://fcmregistrations.googleapis.com",
      "https://*.firebaseio.com",
      "https://*.kakao.com",
      "https://*.kakaocdn.net",
      "https://*.daumcdn.net",
    ].filter(Boolean).join(" "),
    "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://libmo.syu.ac.kr",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    isProduction ? "upgrade-insecure-requests" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
