import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary, type Locale } from "@/lib/i18n";
import { LocaleProvider } from "./LocaleProvider";
import { PwaInstallHelpButton } from "./PwaInstallHelpButton";
import { InAppBrowserNotice } from "./InAppBrowserNotice";

const route = vi.hoisted(() => ({ pathname: "/campus/bus-info" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

// Synthetic UA fixtures exercise the UI; they are not observations from Everytime devices.
const androidWebView = "Mozilla/5.0 (Linux; Android 16; K; wv) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36";
const iosWebView = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

beforeEach(() => {
  route.pathname = "/campus/bus-info";
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  vi.stubGlobal("navigator", { userAgent: androidWebView });
  localStorage.clear();
});
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); window.history.replaceState(null, "", "/"); });

function renderHelp(locale: Locale) {
  render(<LocaleProvider locale={locale}><PwaInstallHelpButton /></LocaleProvider>);
  const trigger = screen.getByRole("button", { name: getDictionary(locale).home.pwaHelpAction });
  fireEvent.click(trigger);
  return trigger;
}

describe("installation help", () => {
  it.each(["ko", "en"] as const)("reopens %s help despite home dismissal and copies only its public homepage", async (locale) => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { userAgent: androidWebView, clipboard: { writeText } });
    localStorage.setItem("syu-campus:pwa-install-dismissed", "true");
    window.history.replaceState(null, "", "/more/meet/private-room?token=private#secret");
    const trigger = renderHelp(locale);
    const text = getDictionary(locale).home;
    const dialog = await screen.findByRole("dialog", { name: text.pwaAction });
    expect(dialog).toHaveTextContent(text.pwaInstallIos);
    expect(dialog).toHaveTextContent(text.pwaInstallBrowser);
    expect(writeText).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/more/meet/private-room");
    const browserLink = await within(dialog).findByRole("link", { name: text.pwaOpenChrome });
    expect(browserLink.getAttribute("href")).not.toMatch(/private|secret|token/);
    fireEvent.click(within(dialog).getByRole("button", { name: text.pwaCopyAddress }));
    await waitFor(() => expect(within(dialog).getByRole("status")).toHaveTextContent(text.pwaAddressCopied));
    expect(writeText).toHaveBeenCalledExactlyOnceWith(locale === "en" ? "https://campus.syu.kr/en" : "https://campus.syu.kr/");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each(["missing", "rejected"])("keeps a selectable address when clipboard is %s", async (mode) => {
    vi.stubGlobal("navigator", { userAgent: iosWebView, ...(mode === "rejected" ? { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } } : {}) });
    renderHelp("ko");
    const text = getDictionary("ko").home;
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByRole("link", { name: text.pwaOpenSafari })).toHaveAttribute("href", "x-safari-https://campus.syu.kr/");
    fireEvent.click(within(dialog).getByRole("button", { name: text.pwaCopyAddress }));
    const address = await within(dialog).findByRole("textbox", { name: text.pwaAddressLabel }) as HTMLInputElement;
    expect(address).toHaveValue("https://campus.syu.kr/");
    expect(address).toHaveAttribute("readonly");
    address.focus();
    expect(address.selectionStart).toBe(0);
    expect(address.selectionEnd).toBe(address.value.length);
    expect(within(dialog).getByRole("status")).toHaveTextContent(text.pwaCopyManually);
    expect(within(dialog).getByRole("button", { name: text.pwaCopyAddress })).toBeEnabled();
  });
});

describe("in-app browser notice", () => {
  it.each([
    ["ko", "android"], ["ko", "ios"], ["en", "android"], ["en", "ios"],
  ] as const)("offers matching %s %s guidance and actions without forcing navigation", async (locale, platform) => {
    vi.stubGlobal("navigator", { userAgent: platform === "android" ? androidWebView : iosWebView });
    window.history.replaceState(null, "", "/campus/bus-info");
    render(<LocaleProvider locale={locale}><InAppBrowserNotice /></LocaleProvider>);
    const text = getDictionary(locale).home;
    const notice = screen.getByRole("region", { name: text.pwaInAppTitle });
    expect(await within(notice).findByRole("link", { name: platform === "android" ? text.pwaOpenChrome : text.pwaOpenSafari })).toHaveAttribute("href", expect.stringContaining(platform === "android" ? "package=com.android.chrome" : "x-safari-https://"));
    expect(notice).toHaveTextContent(text.pwaInAppDescription);
    expect(notice).toHaveTextContent(platform === "android" ? text.pwaOpenChromePrompt : text.pwaOpenSafariPrompt);
    expect(notice).not.toHaveTextContent(platform === "android" ? text.pwaOpenSafariPrompt : text.pwaOpenChromePrompt);
    expect(within(notice).getByRole("button", { name: text.pwaCopyAddress })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/campus/bus-info");
    fireEvent.click(within(notice).getByRole("button", { name: text.dismissPwa }));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(localStorage.getItem("syu-campus:pwa-install-dismissed")).toBeNull();
  });

  it.each(["browser", "standalone", "ios-standalone", "admin"])("does not show the notice in %s", (mode) => {
    if (mode === "browser") vi.stubGlobal("navigator", { userAgent: androidWebView.replace("; wv", "") });
    if (mode === "standalone") vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    if (mode === "ios-standalone") vi.stubGlobal("navigator", { userAgent: iosWebView, standalone: true });
    if (mode === "admin") route.pathname = "/en/admin/content";
    render(<LocaleProvider locale="ko"><InAppBrowserNotice /></LocaleProvider>);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("closes global help and releases scroll lock before following the detailed guide", async () => {
    render(<LocaleProvider locale="ko"><InAppBrowserNotice /></LocaleProvider>);
    const text = getDictionary("ko").home;
    fireEvent.click(screen.getByRole("button", { name: text.pwaHelpAction }));
    const dialog = await screen.findByRole("dialog");
    expect(document.body.style.overflow).toBe("hidden");
    const link = within(dialog).getByRole("link", { name: text.pwaInstallGuide });
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(screen.getByRole("region", { name: text.pwaInAppTitle })).toBeInTheDocument();
  });
});
