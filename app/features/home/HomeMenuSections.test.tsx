import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientLocaleProvider } from "@/app/components/LocaleContext";
import { getDictionary } from "@/lib/i18n";
import { initializePwaInstallPromptCapture } from "@/lib/pwa-install";
import { FrequentMenuGrid, PwaInstallCard } from "./HomeMenuSections";

describe("frequently used home menus", () => {
  it.each([
    ["ko", ["학식", "도서관", "졸업요건 확인", "버스 정보", "캠퍼스 꿀팁", "캠퍼스 지도"]],
    ["en", ["Cafeteria", "Library", "Graduation Check", "Bus Info", "Campus Tips", "Campus Map"]],
  ] as const)("keeps six localized service links in search-click order for %s", (locale, labels) => {
    render(
      <ClientLocaleProvider locale={locale} dictionary={getDictionary(locale)}>
        <FrequentMenuGrid />
      </ClientLocaleProvider>,
    );

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(labels);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/campus/cafeteria",
      "/campus/library",
      "/academic/graduation",
      "/campus/bus-info",
      "/campus/campus-tips",
      "/campus/map",
    ].map((path) => locale === "en" ? `/en${path}` : path));
  });
});

describe("home app installation", () => {
  let stopCapture: () => void;
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    stopCapture = initializePwaInstallPromptCapture();
  });
  afterEach(() => {
    stopCapture();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  function renderCard(locale: "ko" | "en" = "ko") {
    return render(
      <ClientLocaleProvider locale={locale} dictionary={getDictionary(locale)}>
        <PwaInstallCard />
      </ClientLocaleProvider>,
    );
  }

  function offerInstall(outcome: "accepted" | "dismissed" = "dismissed") {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt, userChoice: Promise.resolve({ outcome }),
    });
    act(() => { window.dispatchEvent(event); });
    return { event, prompt };
  }

  it.each(["ko", "en"] as const)("opens localized manual installation when no browser prompt is available: %s", async (locale) => {
    renderCard(locale);
    const text = getDictionary(locale).home;
    const button = screen.getByRole("button", { name: text.pwaAction });
    button.focus();
    fireEvent.click(button);

    const dialog = await screen.findByRole("dialog", { name: text.pwaAction });
    expect(dialog).toHaveTextContent(text.pwaInstallIos);
    expect(dialog).toHaveTextContent(text.pwaInstallBrowser);
    expect(within(dialog).getByRole("link", { name: text.pwaInstallGuide }))
      .toHaveAttribute("href", `${locale === "en" ? "/en" : ""}/service/notices/005-pwa-installation-guide`);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(button).toHaveFocus();
  });

  it("calls the browser prompt directly on click, blocks repeat clicks, and hides after acceptance", async () => {
    renderCard();
    let accept!: (choice: { outcome: "accepted" }) => void;
    const { event, prompt } = offerInstall();
    event.userChoice = new Promise((resolve) => { accept = resolve; });
    const button = screen.getByRole("button", { name: "앱 설치" });

    fireEvent.click(button);
    expect(event.defaultPrevented).toBe(true);
    expect(prompt).toHaveBeenCalledOnce();
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(prompt).toHaveBeenCalledOnce();
    await act(async () => { accept({ outcome: "accepted" }); });
    expect(screen.queryByRole("button", { name: "앱 설치" })).not.toBeInTheDocument();
  });

  it("uses the browser install event captured before the deferred card mounts", async () => {
    const { event, prompt } = offerInstall("accepted");
    expect(event.defaultPrevented).toBe(true);
    renderCard();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "앱 설치" })); });
    expect(prompt).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "앱 설치" })).not.toBeInTheDocument();
  });

  it("restores the install trigger when the lazy dialog opened without a focused button", async () => {
    renderCard();
    const button = screen.getByRole("button", { name: "앱 설치" });
    expect(document.activeElement).not.toBe(button);
    fireEvent.click(button);
    await screen.findByRole("dialog", { name: "앱 설치" });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(button).toHaveFocus());
  });

  it("consumes a dismissed prompt once and can accept a fresh browser event", async () => {
    renderCard();
    const first = offerInstall();
    const button = screen.getByRole("button", { name: "앱 설치" });
    await act(async () => { fireEvent.click(button); });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await screen.findByRole("dialog", { name: "앱 설치" });
    expect(first.prompt).toHaveBeenCalledOnce();
    fireEvent.keyDown(document, { key: "Escape" });

    const next = offerInstall("accepted");
    await act(async () => { fireEvent.click(button); });
    expect(next.prompt).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "앱 설치" })).not.toBeInTheDocument();
  });

  it("falls back to manual installation if the browser prompt rejects", async () => {
    renderCard();
    offerInstall().prompt.mockRejectedValue(new Error("Prompt unavailable"));
    fireEvent.click(screen.getByRole("button", { name: "앱 설치" }));
    await screen.findByRole("dialog", { name: "앱 설치" });
    expect(screen.getByRole("button", { name: "앱 설치" })).toBeEnabled();
  });

  it("hides the card and open help when installation happens from the browser menu", async () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "앱 설치" }));
    await screen.findByRole("dialog");
    act(() => { window.dispatchEvent(new Event("appinstalled")); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "앱 설치" })).not.toBeInTheDocument();
  });

  it.each(["standalone", "ios", "dismissed"])("keeps the card hidden for %s", (mode) => {
    if (mode === "standalone") vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    if (mode === "ios") vi.stubGlobal("navigator", { standalone: true });
    if (mode === "dismissed") localStorage.setItem("syu-campus:pwa-install-dismissed", "true");
    renderCard();
    expect(screen.queryByRole("button", { name: "앱 설치" })).not.toBeInTheDocument();
  });

  it("keeps the app's early capture after the card unmounts and removes the card listener", async () => {
    const removeListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderCard();
    unmount();
    expect(removeListener).toHaveBeenCalledWith("appinstalled", expect.any(Function));
    expect(removeListener.mock.calls.some(([name]) => name === "beforeinstallprompt")).toBe(false);
    const { event, prompt } = offerInstall("accepted");
    expect(event.defaultPrevented).toBe(true);
    renderCard();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "앱 설치" })); });
    expect(prompt).toHaveBeenCalledOnce();
    removeListener.mockRestore();
  });
});
