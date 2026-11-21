import { localizePath, type Locale } from "./i18n/routing";

type BrowserPlatform = "android" | "ios";

export function getBrowserPlatform(userAgent: string, maxTouchPoints = 0): BrowserPlatform | null {
  if (/\bAndroid\b/i.test(userAgent)) return "android";
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return "ios";
  return null;
}

export function isLikelyInAppBrowser(userAgent: string, maxTouchPoints = 0): boolean {
  const platform = getBrowserPlatform(userAgent, maxTouchPoints);
  if (!platform) return false;
  // shortcut: app-controlled UA strings are only hints; update patterns after device verification when apps change.
  if (/KAKAOTALK|everytime|NAVER(?:\(inapp|\/)|Instagram|FBAN\/|FBAV\/|FB_IAB|Line\//i.test(userAgent)) return true;
  if (platform === "android") return /;\s*wv(?:[);\s]|$)/i.test(userAgent);
  return /AppleWebKit/i.test(userAgent) && !/(?:Safari|CriOS|FxiOS|EdgiOS|OPiOS|OPT|DuckDuckGo|YaBrowser|Whale)\//i.test(userAgent);
}

export function getExternalBrowserUrl(platform: BrowserPlatform, locale: Locale): string {
  const publicUrl = new URL(localizePath("/", locale), "https://campus.syu.kr").href;
  if (platform === "android") {
    return `intent://${publicUrl.slice("https://".length)}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(publicUrl)};end`;
  }
  // shortcut: Safari's scheme has no public support contract; recheck on iOS/app changes and keep manual copying available.
  return `x-safari-${publicUrl}`;
}
