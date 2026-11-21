"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserPlatform, getExternalBrowserUrl } from "@/lib/in-app-browser";
import { localizePath } from "@/lib/i18n/routing";
import { Button, buttonStyles } from "./Button";
import { useDictionary, useLocale } from "./LocaleContext";
import { Modal } from "./Modal";

export function BrowserOpenActions() {
  const { home: text } = useDictionary();
  const locale = useLocale();
  const url = new URL(localizePath("/", locale), "https://campus.syu.kr").href;
  const [platform, setPlatform] = useState<ReturnType<typeof getBrowserPlatform>>(null);
  const [status, setStatus] = useState<"copied" | "manual" | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  useEffect(() => {
    setPlatform(getBrowserPlatform(navigator.userAgent ?? "", navigator.maxTouchPoints));
  }, []);

  async function copyAddress() {
    setIsCopying(true);
    setStatus(null);
    try {
      if (!navigator.clipboard?.writeText) {
        setStatus("manual");
        return;
      }
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("manual");
    } finally {
      setIsCopying(false);
    }
  }

  return (
    <div className="min-w-0">
      {platform && (
        <p className="mb-3 text-sm leading-6 text-neutral-600">
          {platform === "android" ? text.pwaOpenChromePrompt : text.pwaOpenSafariPrompt}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {platform && (
          <a href={getExternalBrowserUrl(platform, locale)} className={buttonStyles("primary")}>
            {platform === "android" ? text.pwaOpenChrome : text.pwaOpenSafari}
          </a>
        )}
        <Button variant="secondary" onClick={() => void copyAddress()} disabled={isCopying}>
          {text.pwaCopyAddress}
        </Button>
      </div>
      <p className="mt-2 text-xs leading-5 text-neutral-600">{text.pwaBrowserFallback}</p>
      {status === "manual" && (
        <label className="mt-3 block text-sm font-medium text-neutral-700">
          {text.pwaAddressLabel}
          <input
            type="text"
            readOnly
            value={url}
            onFocus={(event) => event.target.select()}
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm font-normal text-neutral-700"
          />
        </label>
      )}
      <p role="status" className={status ? "mt-2 text-sm text-neutral-700" : undefined}>
        {status === "copied" && text.pwaAddressCopied}
        {status === "manual" && text.pwaCopyManually}
      </p>
    </div>
  );
}

export function PwaInstallHelp({ onClose }: { onClose: () => void }) {
  const { home: text } = useDictionary();
  const locale = useLocale();
  return (
    <Modal isOpen title={text.pwaAction} description={text.pwaInstallHelp} onClose={onClose} size="sm">
      <div className="space-y-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">{text.pwaInAppTitle}</h3>
          <BrowserOpenActions />
        </div>
        <ul className="space-y-3 text-sm leading-6 text-neutral-700">
          <li>{text.pwaInstallIos}</li>
          <li>{text.pwaInstallBrowser}</li>
        </ul>
        <p className="text-sm leading-6 text-neutral-600">{text.pwaStorageHint}</p>
        <Link href={localizePath("/service/notices/005-pwa-installation-guide", locale)} onClick={onClose} className={buttonStyles("secondary")}>
          {text.pwaInstallGuide}
        </Link>
      </div>
    </Modal>
  );
}
