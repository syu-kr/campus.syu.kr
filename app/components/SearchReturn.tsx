"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { stripLocalePrefix } from "@/lib/i18n";
import { readSessionValue, removeSessionValue, writeSessionValue } from "@/lib/browser-storage";
import { useDictionary } from "./LocaleProvider";

const key = "syu-campus-search-return";
type ResultContext = { url: string; scrollY: number; result: string };
export function parseSearchReturn(value: string | null, origin: string): ResultContext | null {
  if (!value) return null;
  try {
    const item = JSON.parse(value) as ResultContext;
    const url = new URL(item.url, origin);
    const result = new URL(item.result, origin);
    if (url.origin !== origin || result.origin !== origin || stripLocalePrefix(url.pathname) !== "/" || !url.searchParams.get("search")?.trim() || !Number.isFinite(item.scrollY) || item.scrollY < 0) return null;
    return { url: url.pathname + url.search, scrollY: item.scrollY, result: result.pathname + result.search + result.hash };
  } catch { return null; }
}

export function SearchReturn() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const dictionary = useDictionary();
  const [saved, setSaved] = useState<ResultContext | null>(null);
  const home = stripLocalePrefix(pathname) === "/";
  const query = params.get("search")?.trim();
  useEffect(() => {
    const prior = parseSearchReturn(readSessionValue(key), location.origin);
    setSaved(current => prior ?? current);
    if (home && !query) { removeSessionValue(key); setSaved(null); }
    if (!home || !query) return;
    const capture = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element)?.closest<HTMLAnchorElement>("main a[href]");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href);
      if (destination.origin !== location.origin || destination.pathname === pathname) return;
      const next = { url: location.pathname + location.search, scrollY: window.scrollY, result: destination.pathname + destination.search + destination.hash };
      writeSessionValue(key, JSON.stringify(next)); setSaved(next);
    };
    document.addEventListener("click", capture, true);
    return () => document.removeEventListener("click", capture, true);
  }, [home, pathname, query]);
  useEffect(() => {
    if (!home || !query || !saved || location.pathname + location.search !== saved.url) return;
    let observer: MutationObserver | undefined;
    const restore = () => {
      const anchor = [...document.querySelectorAll<HTMLAnchorElement>("main a[href]")].find(item => item.pathname + item.search + item.hash === saved.result);
      if (!anchor) return false;
      window.scrollTo({ top: saved.scrollY, behavior: "instant" });
      anchor.focus({ preventScroll: true });
      observer?.disconnect(); return true;
    };
    const frame = requestAnimationFrame(() => {
      if (!restore()) { observer = new MutationObserver(restore); observer.observe(document.querySelector("main")!, { childList: true, subtree: true }); }
    });
    const timeout = window.setTimeout(() => observer?.disconnect(), 10000);
    return () => { cancelAnimationFrame(frame); clearTimeout(timeout); observer?.disconnect(); };
  }, [home, query, saved]);
  if (home || !saved) return null;
  return <div className="m3-search-return"><Link href={saved.url} onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); router.push(saved.url, { scroll: false });
  }}><span aria-hidden="true">←</span>{dictionary.m3.searchReturn}</Link></div>;
}
