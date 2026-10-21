import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { dictionaries, type Locale } from "@/lib/i18n";
import { LocaleProvider } from "./LocaleProvider";
import { FooterShareButton } from "./FooterShareButton";

function openShare(locale: Locale = "ko") {
  render(<LocaleProvider locale={locale}><FooterShareButton /></LocaleProvider>);
  const trigger = screen.getByRole("button", { name: dictionaries[locale].footer.share });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}

describe("FooterShareButton", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(["ko", "en"] as const)("opens a %s dialog from the SVG icon and returns focus on Escape", (locale) => {
    vi.stubGlobal("navigator", {});
    window.history.replaceState(null, "", "/more/meet/private-room?token=private#secret");
    const trigger = openShare(locale);
    const text = dictionaries[locale].footer;

    expect(trigger).toHaveTextContent("");
    expect(trigger.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(trigger).toHaveAttribute("title", text.share);
    expect(screen.getByRole("dialog", { name: text.share })).toHaveAttribute("aria-modal", "true");
    const input = screen.getByRole("textbox", { name: text.shareLinkLabel }) as HTMLInputElement;
    expect(input).toHaveValue(locale === "en" ? "https://campus.syu.kr/en" : "https://campus.syu.kr/");
    expect(input).toHaveAttribute("readonly");
    input.focus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
    expect(screen.queryByRole("button", { name: text.shareDeviceAction })).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it.each(["ko", "en"] as const)("copies the public %s home only after the copy action", async (locale) => {
    const share = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });
    openShare(locale);
    const text = dictionaries[locale].footer;
    expect(share).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: text.shareCopyAction }));

    expect(await screen.findByText(text.shareCopied)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(text.shareCopied);
    expect(writeText).toHaveBeenCalledExactlyOnceWith(
      locale === "en" ? "https://campus.syu.kr/en" : "https://campus.syu.kr/",
    );
    expect(share).not.toHaveBeenCalled();
  });

  it.each(["ko", "en"] as const)("opens the device share sheet with the public %s home", async (locale) => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });
    openShare(locale);
    fireEvent.click(screen.getByRole("button", { name: dictionaries[locale].footer.shareDeviceAction }));

    expect(await screen.findByText(dictionaries[locale].footer.shareCompleted)).toBeInTheDocument();
    expect(share).toHaveBeenCalledExactlyOnceWith({
      title: "SYU CAMPUS",
      url: locale === "en" ? "https://campus.syu.kr/en" : "https://campus.syu.kr/",
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("keeps cancellation silent and leaves the dialog usable", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("Canceled", "AbortError"));
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });
    openShare();
    const button = screen.getByRole("button", { name: dictionaries.ko.footer.shareDeviceAction });

    await act(async () => fireEvent.click(button));

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(writeText).not.toHaveBeenCalled();
    expect(button).toBeEnabled();
  });

  it("copies the link after a device share failure", async () => {
    const share = vi.fn().mockRejectedValue(new Error("Share unavailable"));
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });
    openShare();
    fireEvent.click(screen.getByRole("button", { name: dictionaries.ko.footer.shareDeviceAction }));

    expect(await screen.findByText(dictionaries.ko.footer.shareCopied)).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledExactlyOnceWith("https://campus.syu.kr/");
  });

  it.each(["ko", "en"] as const)("keeps a selectable %s link available when clipboard access fails", async (locale) => {
    const writeText = vi.fn().mockRejectedValue(new Error("Clipboard denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    openShare(locale);
    fireEvent.click(screen.getByRole("button", { name: dictionaries[locale].footer.shareCopyAction }));

    expect(await screen.findByText(dictionaries[locale].footer.shareCopyManually)).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: dictionaries[locale].footer.shareLinkLabel }) as HTMLInputElement;
    expect(input).toHaveValue(locale === "en" ? "https://campus.syu.kr/en" : "https://campus.syu.kr/");
    input.focus();
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it("provides manual copying when neither browser API is available", async () => {
    vi.stubGlobal("navigator", {});
    openShare();
    fireEvent.click(screen.getByRole("button", { name: dictionaries.ko.footer.shareCopyAction }));

    expect(await screen.findByText(dictionaries.ko.footer.shareCopyManually)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: dictionaries.ko.footer.shareLinkLabel })).toHaveValue("https://campus.syu.kr/");
  });

  it("disables both actions while the device share sheet is open", async () => {
    let completeShare!: () => void;
    const share = vi.fn(() => new Promise<void>((resolve) => { completeShare = resolve; }));
    vi.stubGlobal("navigator", { share });
    openShare();
    const deviceShare = screen.getByRole("button", { name: dictionaries.ko.footer.shareDeviceAction });
    const copy = screen.getByRole("button", { name: dictionaries.ko.footer.shareCopyAction });

    fireEvent.click(deviceShare);
    fireEvent.click(deviceShare);
    expect(deviceShare).toBeDisabled();
    expect(copy).toBeDisabled();
    expect(share).toHaveBeenCalledOnce();

    await act(async () => completeShare());
    expect(deviceShare).toBeEnabled();
    expect(copy).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent(dictionaries.ko.footer.shareCompleted);
  });
});
