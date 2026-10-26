"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { PublicBanner } from "@/types/managed-content";
import { useDictionary, useLocale } from "./LocaleContext";
import { localizePath } from "@/lib/i18n/routing";
import { getKoreaDateTimeParts } from "@/lib/korea-time";
import { useContentTranslation } from "./ContentTranslation";
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
    ["home", "site-top"].includes(item.placement) && ["notice", "event", "ad"].includes(item.category) &&
    [item.title, item.description, item.imageAlt, item.imageDesktop, item.imageMobile, item.link].every(field => typeof field === "string") &&
    [item.imageDesktop, item.imageMobile].every(field => !field || mediaPattern.test(field)) &&
    [item.startsAt, item.endsAt].every(field => field === null || (typeof field === "string" && Number.isFinite(Date.parse(field)))) &&
    typeof item.dismissible === "boolean" && Number.isFinite(item.priority);
}
const storageKey = (item: PublicBanner) => `campus-banner:${item.id}:${item.revision}`;
const visibleAt = (item: PublicBanner, now: number) => (!item.startsAt || Date.parse(item.startsAt) <= now) && (!item.endsAt || now < Date.parse(item.endsAt));

export function ManagedBanners({ initialBanners, placement, initialNow }: { initialBanners: PublicBanner[]; placement: PublicBanner["placement"]; initialNow: number }) {
  const labels = useDictionary().managedBanners;
  const [items, setItems] = useState(initialBanners);
  const [now, setNow] = useState(initialNow);
  const [dismissed, setDismissed] = useState<Record<string, number>>({});
  useEffect(() => {
    const stored: Record<string, number> = {};
    for (const item of items) {
      try { const until = Number(localStorage.getItem(storageKey(item)));if (until > Date.now()) stored[storageKey(item)] = until; } catch { /* Reading remains available without browser storage. */ }
    }
    setDismissed(current => ({ ...stored, ...current }));
  }, [items]);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const poll = async () => {
      setNow(Date.now());
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch(`/api/banners?placement=${placement}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) return;
        const body: unknown = await response.json();
        if (!disposed && body && typeof body === "object" && "banners" in body && Array.isArray(body.banners) && body.banners.every(validBanner)) setItems(body.banners);
      } catch { /* Preserve the last public snapshot; expiration is checked separately. */ }
    };
    const interval = window.setInterval(() => void poll(), 30_000);
    const refresh = () => { if (document.visibilityState === "visible") void poll(); };
    document.addEventListener("visibilitychange", refresh);
    return () => { disposed = true;controller.abort();window.clearInterval(interval);document.removeEventListener("visibilitychange", refresh); };
  }, [placement]);
  useEffect(() => {
    const nextEnd = items.map(item => item.endsAt ? Date.parse(item.endsAt) : Infinity).filter(time => time > now).sort((a, b) => a - b)[0];
    if (!Number.isFinite(nextEnd)) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(2_147_000_000, nextEnd - Date.now() + 10));
    return () => window.clearTimeout(timer);
  }, [items, now]);
  const handleDismiss = useCallback((item: PublicBanner, today: boolean) => {
    const current = Date.now();
    const parts = getKoreaDateTimeParts(new Date(current));
    const until = today ? Date.UTC(parts.year, parts.month - 1, parts.date + 1) - 9 * 60 * 60 * 1000 : Infinity;
    setDismissed(value => ({ ...value, [storageKey(item)]: until }));
    if (today) try { localStorage.setItem(storageKey(item), String(until)); } catch { /* This visit can still dismiss the banner. */ }
  }, []);
  const shown = items.filter(item => item.placement === placement && visibleAt(item, now) && !(dismissed[storageKey(item)] > now)).slice(0, 3);
  if (!shown.length) return null;
  return <section className={`m3-managed-banners m3-managed-banners-${placement}`} aria-label={labels.regionLabel}>
    {shown.map(item => <ManagedBannerItem key={`${item.id}:${item.revision}`} item={item} onDismiss={handleDismiss} />)}
  </section>;
}

function ManagedBannerItem({ item, onDismiss }: { item: PublicBanner; onDismiss: (item: PublicBanner, today: boolean) => void }) {
  const locale = useLocale(), labels = useDictionary().managedBanners;
  const translation = useContentTranslation({ kind: "banner", id: item.id }, { title: item.title, ...(item.description ? { description: item.description } : {}), ...(item.imageAlt ? { imageAlt: item.imageAlt } : {}) });
  const href = safeLink(item.link), external = href.startsWith("https://");
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
      return <article className="m3-managed-banner" data-category={item.category}>
        {href ? <Link href={external ? href : localizePath(href, locale)} target={external ? "_blank" : undefined} rel={external ? `${item.category === "ad" ? "sponsored nofollow " : ""}noopener noreferrer` : undefined}>{content}</Link> : <div>{content}</div>}
        {item.dismissible && <div className="m3-managed-banner-actions">
          <button type="button" onClick={() => onDismiss(item, true)}>{labels.hideToday}</button>
          <button type="button" aria-label={`${labels.close}: ${translation.text("title", item.title)}`} onClick={() => onDismiss(item, false)}>×</button>
        </div>}
      </article>;
}
