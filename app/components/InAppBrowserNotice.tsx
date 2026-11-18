"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { isLikelyInAppBrowser } from "@/lib/in-app-browser";
import { useDictionary } from "./LocaleContext";
import { Button } from "./Button";
import { PwaInstallHelpButton } from "./PwaInstallHelpButton";

const BrowserOpenActions = dynamic(() => import("./PwaInstallHelp").then((module) => module.BrowserOpenActions));

export function InAppBrowserNotice() {
  const [isVisible, setIsVisible] = useState(false);
  const { home: text } = useDictionary();
  const pathname = usePathname();

  useEffect(() => {
    const isStandalone = window.matchMedia?.("(display-mode: standalone), (display-mode: fullscreen)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone;
    setIsVisible(!isStandalone && isLikelyInAppBrowser(navigator.userAgent ?? "", navigator.maxTouchPoints));
    const hide = () => setIsVisible(false);
    window.addEventListener("appinstalled", hide);
    return () => window.removeEventListener("appinstalled", hide);
  }, []);

  if (!isVisible || /^\/(?:en\/)?admin(?:\/|$)/.test(pathname ?? "")) return null;

  return (
    <section className="mx-auto my-4 w-full max-w-4xl px-4 print:hidden" aria-label={text.pwaInAppTitle}>
      <div className="rounded-card border border-primary-100 bg-primary-50 p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-neutral-900">{text.pwaInAppTitle}</h2>
            <p className="mt-1 text-sm leading-6 text-neutral-600">{text.pwaInAppDescription}</p>
          </div>
          <Button variant="ghost" className="m3-icon-button shrink-0 px-0" aria-label={text.dismissPwa} onClick={() => setIsVisible(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
          </Button>
        </div>
        <BrowserOpenActions />
        <div className="mt-3"><PwaInstallHelpButton /></div>
      </div>
    </section>
  );
}
