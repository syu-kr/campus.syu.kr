"use client";

import { useState } from "react";

import { Button } from "./Button";
import { useDictionary, useLocale } from "./LocaleProvider";
import { Modal } from "./Modal";
import { localizePath } from "@/lib/i18n/routing";

export function FooterShareButton() {
  const { footer: text } = useDictionary();
  const locale = useLocale();
  const url = new URL(localizePath("/", locale), "https://campus.syu.kr").href;
  const [isOpen, setIsOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [status, setStatus] = useState<"shared" | "copied" | "manual" | null>(null);

  async function handleShare(useNativeShare: boolean) {
    setIsSharing(true);
    setStatus(null);

    try {
      if (useNativeShare && navigator.share) {
        try {
          await navigator.share({ title: "SYU CAMPUS", url });
          setStatus("shared");
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setStatus("copied");
      } else {
        setStatus("manual");
      }
    } catch {
      setStatus("manual");
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        className="w-11 shrink-0 rounded-full px-0"
        aria-label={text.share}
        title={text.share}
        aria-haspopup="dialog"
        onClick={() => { setStatus(null); setIsOpen(true); }}
      >
        <svg
          data-slot="icon"
          className="h-5 w-5"
          fill="none"
          strokeWidth="1.5"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
          />
        </svg>
      </Button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={text.share}
        description={text.shareDescription}
        size="sm"
      >
        <label className="block text-sm font-medium text-neutral-700">
          {text.shareLinkLabel}
          <input
            type="text"
            readOnly
            value={url}
            onFocus={(event) => event.target.select()}
            className="mt-2 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm font-normal text-neutral-700"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void handleShare(false)} disabled={isSharing}>
            {text.shareCopyAction}
          </Button>
          {isOpen && typeof navigator.share === "function" && (
            <Button variant="secondary" onClick={() => void handleShare(true)} disabled={isSharing}>
              {text.shareDeviceAction}
            </Button>
          )}
        </div>
        <p role="status" className="mt-3 text-sm text-neutral-600">
          {status === "shared" && text.shareCompleted}
          {status === "copied" && text.shareCopied}
          {status === "manual" && text.shareCopyManually}
        </p>
      </Modal>
    </>
  );
}
