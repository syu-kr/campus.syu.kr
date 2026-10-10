import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALE_COOKIE_NAME, type Locale } from "@/lib/i18n";
import { LanguageSelector } from "./LanguageSelector";
import { LocaleProvider } from "./LocaleProvider";

const route = vi.hoisted(() => ({ pathname: "/campus/bus-info", query: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useSearchParams: () => new URLSearchParams(route.query),
}));

const navigate = vi.fn();
let cookieAtNavigation = "";

beforeEach(() => {
  route.pathname = "/campus/bus-info";
  route.query = "";
  cookieAtNavigation = "";
  document.cookie = `${LOCALE_COOKIE_NAME}=; path=/; max-age=0`;
  window.history.replaceState(null, "", "/campus/bus-info#shuttle-map");
  navigate.mockReset().mockImplementation(() => { cookieAtNavigation = document.cookie; });
  // jsdom cannot navigate; keep its DOM APIs while observing the document destination.
  vi.stubGlobal("window", new Proxy(window, {
    get(target, key) {
      return key === "location"
        ? { origin: target.location.origin, hash: target.location.hash, assign: navigate }
        : Reflect.get(target, key, target);
    },
  }));
});

afterEach(() => { vi.unstubAllGlobals(); });

function renderSelector(locale: Locale) {
  render(<LocaleProvider locale={locale}><LanguageSelector /></LocaleProvider>);
  return screen.getByRole("combobox");
}

describe("language document navigation", () => {
  it.each([
    ["ko", "/campus/bus-info", "en", "/en/campus/bus-info"],
    ["en", "/en/campus/bus-info", "ko", "/campus/bus-info"],
    ["ko", "/", "en", "/en"],
    ["en", "/en", "ko", "/"],
  ] as const)("switches %s to %s with the cookie, query and anchor intact", (locale, pathname, nextLocale, destination) => {
    route.pathname = pathname;
    route.query = "search=notice&mode=full";
    fireEvent.change(renderSelector(locale), { target: { value: nextLocale } });

    expect(navigate).toHaveBeenCalledExactlyOnceWith(`${window.location.origin}${destination}?search=notice&mode=full#shuttle-map`);
    expect(cookieAtNavigation).toContain(`${LOCALE_COOKIE_NAME}=${nextLocale}`);
  });

  it.each([
    "javascript:alert(1)",
    "https://other.example/escape",
    "//other.example/escape",
    "/en//other.example/escape",
    "/\\other.example/escape",
  ])("keeps an unsafe pathname %s on the current origin", (pathname) => {
    route.pathname = pathname;
    route.query = "redirect=javascript%3Aalert%281%29";
    window.history.replaceState(null, "", "/en/campus/bus-info#javascript:alert(1)");
    fireEvent.change(renderSelector("en"), { target: { value: "ko" } });

    expect(navigate).toHaveBeenCalledOnce();
    const destination = new URL(navigate.mock.calls[0][0]);
    expect(destination.origin).toBe(window.location.origin);
    expect(destination.protocol).toBe("http:");
    expect(destination.searchParams.get("redirect")).toBe("javascript:alert(1)");
    expect(destination.hash).toBe("#javascript:alert(1)");
  });

  it.each(["ko", "en"] as const)("leaves the current %s language and document untouched", (locale) => {
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/`;
    fireEvent.change(renderSelector(locale), { target: { value: locale } });

    expect(navigate).not.toHaveBeenCalled();
    expect(document.cookie).toContain(`${LOCALE_COOKIE_NAME}=${locale}`);
  });
});
