"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { PublicBanner } from "@/types/managed-content";
import { useDictionary, useLocale } from "./LocaleContext";
import { localizePath } from "@/lib/i18n/routing";
import { getKoreaDateTimeParts } from "@/lib/korea-time";
import { PageTranslationStatus, useContentTranslation } from "./ContentTranslation";
import { NativeManagedPopup } from "./NativeManagedPopup";
import "@/app/styles/m3/managed-banners.css";

function safeLink(value: string) {
  if (value.startsWith("/") && !value.startsWith("//") && !/[\\\u0000-\u0020]/.test(value)) return value;
  try { const url = new URL(value);return url.protocol === "https:" && !url.username && !url.password ? url.href : ""; } catch { return ""; }
}
const mediaPattern = /^\/api\/content-media\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validBanner(value: unknown): value is PublicBanner {
  if (!value || typeof value !== "object") return false;
  const item = value as PublicBanner;
  return item.kind === "banner" && typeof item.id === "string" && Number.isSafeInteger(item.revision) &&
    ["home", "site-top", "popup"].includes(item.placement) && ["notice", "event", "ad"].includes(item.category) &&
    [item.title, item.description, item.imageAlt, item.imageDesktop, item.imageMobile, item.link].every(field => typeof field === "string") &&
    [item.imageDesktop, item.imageMobile].every(field => !field || mediaPattern.test(field)) &&
    [item.startsAt, item.endsAt].every(field => field === null || (typeof field === "string" && Number.isFinite(Date.parse(field)))) &&
    typeof item.dismissible === "boolean" && Number.isFinite(item.priority);
}
const storageKey = (item: PublicBanner) => `campus-banner:${item.id}:${item.revision}`;
const visibleAt = (item: PublicBanner, now: number) => (!item.startsAt || Date.parse(item.startsAt) <= now) && (!item.endsAt || now < Date.parse(item.endsAt));

export function ManagedBanners({ initialBanners, placement, initialNow, nonce }: { initialBanners: PublicBanner[]; placement: PublicBanner["placement"]; initialNow: number; nonce?: string }) {
  const labels = useDictionary().managedBanners;
  const pathname = usePathname() ?? "/";
  const excluded = /^\/(?:en\/)?(?:admin(?:\/|$)|campus\/roommates(?:\/|$)|more\/meet\/[^/]+(?:\/|$))/.test(pathname);
  const [items, setItems] = useState(initialBanners);
  const [now, setNow] = useState(initialNow);
  const [dismissed, setDismissed] = useState<Record<string, number>>({});
  const [checkedStorage, setCheckedStorage] = useState<string | null>(null);
  const [otherDialogOpen, setOtherDialogOpen] = useState(false);
  const storageSnapshot = items.map(storageKey).join("|");
  useEffect(() => {
    if (placement !== "popup" || excluded) return;
    const refresh = () => {
      setOtherDialogOpen(Boolean(document.querySelector('[role="dialog"][aria-modal="true"]:not(.m3-managed-popup-overlay), dialog[open]:not(.m3-managed-popup-overlay)')));
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["role", "aria-modal", "open", "hidden"] });
    return () => observer.disconnect();
  }, [placement, excluded]);
  useEffect(() => {
    const stored: Record<string, number> = {};
    for (const item of items) {
      try { const until = Number(localStorage.getItem(storageKey(item)));if (until > Date.now()) stored[storageKey(item)] = until; } catch { /* Reading remains available without browser storage. */ }
      if (placement === "popup") {
        try { if (sessionStorage.getItem(storageKey(item)) === "closed") stored[storageKey(item)] = Infinity; } catch { /* Dismissal remains available in memory. */ }
        // The server-rendered dialog can be dismissed before React or browser storage is ready.
        const early = Array.from(document.querySelectorAll<HTMLElement>("[data-managed-popup]")).find(dialog => dialog.dataset.managedPopup === storageKey(item))?.dataset.dismissedUntil;
        if (early === "closed") stored[storageKey(item)] = Infinity;
        else if (Number(early) > Date.now()) stored[storageKey(item)] = Number(early);
      }
    }
    setDismissed(current => ({ ...stored, ...current }));
    setCheckedStorage(storageSnapshot);
  }, [items, placement, storageSnapshot]);
  useEffect(() => {
    if (excluded) return;
    let disposed = false;
    let inFlight = false;
    let recovered = initialBanners.length > 0;
    let recoveryAttempts = 0;
    let recoveryTimer: number | undefined;
    let controller: AbortController | undefined;
    let requestTimer: number | undefined;
    const poll = async () => {
      setNow(Date.now());
      if (document.visibilityState === "hidden" || inFlight) return;
      window.clearTimeout(recoveryTimer);
      inFlight = true;
      const request = new AbortController();
      controller = request;
      requestTimer = window.setTimeout(() => request.abort(), 8000);
      try {
        const response = await fetch(`/api/banners?placement=${placement}`, { signal: request.signal, cache: "no-store" });
        if (!response.ok) return;
        const body: unknown = await response.json();
        if (!disposed && body && typeof body === "object" && "banners" in body && Array.isArray(body.banners) && body.banners.every(validBanner)) {
          setItems(body.banners);
          recovered ||= body.banners.length > 0;
        }
      } catch { /* Preserve the last public snapshot; expiration is checked separately. */ }
      finally {
        window.clearTimeout(requestTimer);
        controller = undefined;
        inFlight = false;
        if (!disposed && !recovered && recoveryAttempts < 2) recoveryTimer = window.setTimeout(() => void poll(), ++recoveryAttempts * 1000);
      }
    };
    const interval = window.setInterval(() => void poll(), 30_000);
    if (!initialBanners.length) void poll();
    const refresh = () => { if (document.visibilityState === "visible") void poll(); };
    document.addEventListener("visibilitychange", refresh);
    return () => { disposed = true;controller?.abort();window.clearTimeout(requestTimer);window.clearInterval(interval);window.clearTimeout(recoveryTimer);document.removeEventListener("visibilitychange", refresh); };
  }, [placement, initialBanners.length, excluded]);
  useEffect(() => {
    const nextBoundary = [...items.flatMap(item => [item.startsAt, item.endsAt].map(value => value ? Date.parse(value) : Infinity)), ...Object.values(dismissed)].filter(time => time > now).sort((a, b) => a - b)[0];
    if (!Number.isFinite(nextBoundary)) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(2_147_000_000, nextBoundary - Date.now() + 10));
    return () => window.clearTimeout(timer);
  }, [items, now, dismissed]);
  const handleDismiss = useCallback((item: PublicBanner, today: boolean) => {
    const current = Date.now();
    const parts = getKoreaDateTimeParts(new Date(current));
    const until = today ? Date.UTC(parts.year, parts.month - 1, parts.date + 1) - 9 * 60 * 60 * 1000 : Infinity;
    setDismissed(value => ({ ...value, [storageKey(item)]: until }));
    if (today) try { localStorage.setItem(storageKey(item), String(until)); } catch { /* This visit can still dismiss the banner. */ }
    if (!today && item.placement === "popup") try { sessionStorage.setItem(storageKey(item), "closed"); } catch { /* This visit can still dismiss the popup. */ }
  }, []);
  if (excluded) return null;
  const shown = items.filter(item => item.placement === placement && visibleAt(item, now) && !(dismissed[storageKey(item)] > now)).slice(0, 3);
  if (!shown.length) return null;
  if (placement === "popup") return !otherDialogOpen ? <ManagedBannerItem key={storageKey(shown[0])} item={shown[0]} onDismiss={handleDismiss} popupReady={checkedStorage === storageSnapshot} nonce={nonce} /> : null;
  return <section className={`m3-managed-banners m3-managed-banners-${placement}`} aria-label={labels.regionLabel}>
    {shown.map(item => <ManagedBannerItem key={`${item.id}:${item.revision}`} item={item} onDismiss={handleDismiss} />)}
  </section>;
}

function ManagedBannerItem({ item, onDismiss, popupReady = true, nonce }: { item: PublicBanner; onDismiss: (item: PublicBanner, today: boolean) => void; popupReady?: boolean; nonce?: string }) {
  const locale = useLocale(), labels = useDictionary().managedBanners;
  const translation = useContentTranslation({ kind: "banner", id: item.id }, { title: item.title, ...(item.description ? { description: item.description } : {}), ...(item.imageAlt ? { imageAlt: item.imageAlt } : {}) }, popupReady);
  const href = safeLink(item.link), external = href.startsWith("https://");
  if (item.placement === "popup") return <NativeManagedPopup title={translation.text("title", item.title)} titleLang={translation.lang} onClose={() => onDismiss(item, false)} ready={popupReady} nonce={nonce} storageKey={storageKey(item)} startsAt={item.startsAt} endsAt={item.endsAt}>
    {mediaPattern.test(item.imageDesktop) && <picture className="m3-managed-popup-image">
      {mediaPattern.test(item.imageMobile) && <source media="(max-width: 599px)" data-srcset={item.imageMobile} srcSet={popupReady ? item.imageMobile : undefined} suppressHydrationWarning />}
      <Image src={popupReady ? item.imageDesktop : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1600' height='1000'/%3E"} data-src={item.imageDesktop} alt={translation.text("imageAlt", item.imageAlt)} width={1600} height={1000} loading="eager" fetchPriority="high" unoptimized suppressHydrationWarning />
    </picture>}
    <div className="m3-managed-popup-copy">
      {item.category === "ad" && <span className="m3-managed-banner-category">{labels.ad}</span>}
      {item.description && <p lang={translation.lang}>{translation.text("description", item.description)}</p>}
      {href && <Link href={external ? href : localizePath(href, locale)} target={external ? "_blank" : undefined} rel={external ? `${item.category === "ad" ? "sponsored nofollow " : ""}noopener noreferrer` : undefined} data-popup-action="close" onClick={() => onDismiss(item, false)}>{labels.details}{external && <span className="sr-only"> · {labels.external}</span>}</Link>}
    </div>
    <PageTranslationStatus translation={translation} />
    <div className="m3-managed-popup-actions">
      <button type="button" data-popup-action="today" onClick={() => onDismiss(item, true)}>{labels.hideToday}</button>
      <button type="button" data-popup-action="close" onClick={() => onDismiss(item, false)}>{labels.popupClose}</button>
    </div>
  </NativeManagedPopup>;
  const content = <>
        {mediaPattern.test(item.imageDesktop) && <picture className="m3-managed-banner-image">
          {mediaPattern.test(item.imageMobile) && <source media="(max-width: 599px)" srcSet={item.imageMobile} />}
          <Image src={item.imageDesktop} alt={translation.text("imageAlt", item.imageAlt)} width={1600} height={500} unoptimized />
        </picture>}
        <div className="m3-managed-banner-copy"><span className="m3-managed-banner-category">{labels[item.category]}</span>
          <h2 lang={translation.lang}>{translation.text("title", item.title)}</h2>{item.description && <p lang={translation.lang}>{translation.text("description", item.description)}</p>}
          {external && <span className="sr-only">{labels.external}</span>}
        </div>
      </>;
      return <article className="m3-managed-banner" data-category={item.category} data-has-image={mediaPattern.test(item.imageDesktop) || undefined}>
        {href ? <Link className="m3-managed-banner-content" href={external ? href : localizePath(href, locale)} target={external ? "_blank" : undefined} rel={external ? `${item.category === "ad" ? "sponsored nofollow " : ""}noopener noreferrer` : undefined}>{content}</Link> : <div className="m3-managed-banner-content">{content}</div>}
        {item.dismissible && <div className="m3-managed-banner-actions">
          <button type="button" onClick={() => onDismiss(item, true)}>{labels.hideToday}</button>
          <button type="button" aria-label={`${labels.close}: ${translation.text("title", item.title)}`} onClick={() => onDismiss(item, false)}>×</button>
        </div>}
      </article>;
}
