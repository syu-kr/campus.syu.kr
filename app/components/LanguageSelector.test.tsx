import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALE_COOKIE_NAME, localeLabels, type Locale } from "@/lib/i18n";
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

async function chooseLocale(trigger: HTMLElement, locale: Locale) {
  fireEvent.click(trigger);
  const option = await screen.findByRole("option", { name: localeLabels[locale] });
  fireEvent.pointerDown(option);
  fireEvent.click(option);
}

describe("language document navigation", () => {
  it.each([
    ["ko", "/campus/bus-info", "en", "/en/campus/bus-info"],
    ["en", "/en/campus/bus-info", "ko", "/campus/bus-info"],
    ["ko", "/", "en", "/en"],
    ["en", "/en", "ko", "/"],
  ] as const)("switches %s to %s with the cookie, query and anchor intact", async (locale, pathname, nextLocale, destination) => {
    route.pathname = pathname;
    route.query = "search=notice&mode=full";
    await chooseLocale(renderSelector(locale), nextLocale);

    expect(navigate).toHaveBeenCalledExactlyOnceWith(`${window.location.origin}${destination}?search=notice&mode=full#shuttle-map`);
    expect(cookieAtNavigation).toContain(`${LOCALE_COOKIE_NAME}=${nextLocale}`);
  });

  it.each([
    "javascript:alert(1)",
    "https://other.example/escape",
    "//other.example/escape",
    "/en//other.example/escape",
    "/\\other.example/escape",
  ])("keeps an unsafe pathname %s on the current origin", async (pathname) => {
    route.pathname = pathname;
    route.query = "redirect=javascript%3Aalert%281%29";
    window.history.replaceState(null, "", "/en/campus/bus-info#javascript:alert(1)");
    await chooseLocale(renderSelector("en"), "ko");

    expect(navigate).toHaveBeenCalledOnce();
    const destination = new URL(navigate.mock.calls[0][0]);
    expect(destination.origin).toBe(window.location.origin);
    expect(destination.protocol).toBe("http:");
    expect(destination.searchParams.get("redirect")).toBe("javascript:alert(1)");
    expect(destination.hash).toBe("#javascript:alert(1)");
  });

  it.each(["ko", "en"] as const)("leaves the current %s language and document untouched", async (locale) => {
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/`;
    await chooseLocale(renderSelector(locale), locale);

    expect(navigate).not.toHaveBeenCalled();
    expect(document.cookie).toContain(`${LOCALE_COOKIE_NAME}=${locale}`);
  });

  it("uses the shared popup with the two original language labels and restores keyboard focus on Escape", async () => {
    const trigger = renderSelector("ko");
    expect(trigger).toHaveAccessibleName("국가/언어 설정");
    expect(document.querySelector("select")).toBeNull();
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([localeLabels.ko, localeLabels.en]);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(options[0], { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(navigate).not.toHaveBeenCalled();
  });
});
