import { describe, expect, it } from "vitest";
import { getBrowserPlatform, getExternalBrowserUrl, isLikelyInAppBrowser } from "./in-app-browser";

// Synthetic UA samples test classification rules, not actual Everytime/device compatibility.
const android = "Mozilla/5.0 (Linux; Android 16; Pixel) AppleWebKit/537.36 Chrome/143.0.0.0 Mobile Safari/537.36";
const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15";

describe("in-app browser hints", () => {
  it("recognizes Android, iPhone and desktop-mode iPad without treating a Mac as iOS", () => {
    expect(getBrowserPlatform(android)).toBe("android");
    expect(getBrowserPlatform(iphone)).toBe("ios");
    expect(getBrowserPlatform(mac, 5)).toBe("ios");
    expect(getBrowserPlatform(mac)).toBeNull();
    expect(getBrowserPlatform("")).toBeNull();
  });

  it.each(["Everytime/1.0", "KAKAOTALK/1.0", "NAVER(inapp; 1.0)", "NAVER/1.0", "Instagram 1.0", "FBAN/FBIOS", "FBAV/1.0", "FB_IAB/1.0", "Line/1.0"])("recognizes a mobile app marker: %s", (marker) => {
    expect(isLikelyInAppBrowser(`${iphone} Safari/605.1.15 ${marker}`)).toBe(true);
  });

  it("recognizes Android WebView and unbranded iOS WebView hints", () => {
    expect(isLikelyInAppBrowser(android.replace("Pixel)", "Pixel; wv)"))).toBe(true);
    expect(isLikelyInAppBrowser(iphone)).toBe(true);
    expect(isLikelyInAppBrowser(mac.replace(" Safari/605.1.15", ""), 5)).toBe(true);
  });

  it.each([android, mac, `${iphone} Version/26.0 Safari/605.1.15`, ...["CriOS", "FxiOS", "EdgiOS", "OPiOS", "OPT", "DuckDuckGo"].map((browser) => `${iphone} ${browser}/143.0`), ""])("does not label a regular or unknown browser as in-app: %s", (userAgent) => {
    expect(isLikelyInAppBrowser(userAgent)).toBe(false);
  });

  it("does not mistake desktop-mode iPad Safari for an in-app browser", () => {
    expect(isLikelyInAppBrowser(mac, 5)).toBe(false);
  });
});

describe("public installation handoff", () => {
  it.each(["ko", "en"] as const)("opens only the %s public homepage, including Android fallback", (locale) => {
    const url = locale === "ko" ? "https://campus.syu.kr/" : "https://campus.syu.kr/en";
    expect(getExternalBrowserUrl("ios", locale)).toBe(`x-safari-${url}`);
    expect(getExternalBrowserUrl("android", locale)).toBe(
      `intent://${url.slice(8)}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`,
    );
  });
});
