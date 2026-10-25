"use client";

import { memo, useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { WeatherWidget } from "./WeatherWidget";
import { BrandMark } from "./BrandMark";
import { Icon } from "./Icon";
import { NavigationPendingIndicator } from "./NavigationPendingIndicator";
import { fetchWeather, WEATHER_REFRESH_INTERVAL_MS } from "@/lib/weather";
import { localizePath, stripLocalePrefix } from "@/lib/i18n/routing";
import { useRoommatesEnabled } from "./RoommatesAvailability";
import { getSiteSection } from "@/lib/site-presentation";
import { getDesktopNavigationGroups, getPrimaryNavigation } from "./site-navigation";
import { useDictionary, useLocale } from "./LocaleProvider";
import "./sliding-indicator.css";

const WeatherModal = dynamic(() => import("./WeatherModal").then((module) => module.WeatherModal));
const SearchDialog = dynamic(() => import("./SearchDialog"));

function HeaderComponent() {
  const pathname = usePathname();
  const locale = useLocale(), dictionary = useDictionary();
  const [weatherModalOpen, setWeatherModalOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const { data: weather, isPending, isError, refetch } = useQuery({
    queryKey: ["weather"], queryFn: fetchWeather,
    staleTime: WEATHER_REFRESH_INTERVAL_MS, refetchInterval: WEATHER_REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: true, retry: false,
  });
  const weatherData = weather ? {
    ...weather, stale: weather.stale || isError,
    sourceStatus: isError ? "error" as const : weather.sourceStatus,
  } : null;

  useEffect(() => { setSearchOpen(false); setWeatherModalOpen(false); }, [pathname]);

  useEffect(() => {
    const media = window.matchMedia?.("(max-width:899px)");
    if (!media) return;
    let lastHref: string | null = null;
    const rememberFocus = (event: globalThis.FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[data-primary-destination]");
      if (anchor) lastHref = anchor.getAttribute("href");
      else if (target !== document.body) lastHref = null;
    };
    const transferFocus = (event: MediaQueryListEvent) => {
      const active = document.activeElement;
      const target = active?.matches("a[data-primary-destination]") ? active.getAttribute("href") :
        active === document.body ? lastHref : null;
      if (!target) return;
      window.requestAnimationFrame(() => {
        const scope = event.matches ? ".m3-bottom-nav" : ".m3-desktop-navigation";
        Array.from(document.querySelectorAll<HTMLAnchorElement>(scope + " a"))
          .find((link) => link.getAttribute("href") === target)?.focus({ preventScroll: true });
      });
    };
    document.addEventListener("focusin", rememberFocus);
    media.addEventListener("change", transferFocus);
    return () => {
      document.removeEventListener("focusin", rememberFocus);
      media.removeEventListener("change", transferFocus);
    };
  }, []);

  const closeSearch = () => {
    setSearchOpen(false);
    window.requestAnimationFrame(() => searchTrigger.current?.focus({ preventScroll: true }));
  };
  return <>
    <header className="m3-header">
      <Link className="m3-brand relative" href={localizePath("/", locale)}
        aria-label={dictionary.navigation.homepageTitle} title={dictionary.navigation.homepageTitle}>
        <BrandMark className="m3-logo" /><span>SYU CAMPUS</span>
        <NavigationPendingIndicator className="-bottom-1 inset-x-4 bg-primary-500" />
      </Link>
      <DesktopNavigation />
      <div className="m3-header-tools">
        <WeatherWidget weather={weatherData} loading={isPending} failed={isError}
          onClick={() => setWeatherModalOpen(true)} onRetry={() => void refetch()} />
        <button ref={searchTrigger} type="button" className="m3-search-trigger" aria-label={dictionary.search.label}
          aria-haspopup="dialog" aria-expanded={searchOpen} onClick={() => setSearchOpen(true)}>
          <Icon name="search" size={22} />
        </button>
      </div>
    </header>
    {weatherModalOpen && <WeatherModal isOpen weather={weatherData} onClose={() => setWeatherModalOpen(false)} onRetry={() => void refetch()} />}
    {searchOpen && <SearchDialog onClose={closeSearch} />}
  </>;
}

function DesktopNavigation() {
  const roommatesEnabled = useRoommatesEnabled();
  const pathname = usePathname(), locale = useLocale(), dictionary = useDictionary();
  const clean = stripLocalePrefix(pathname ?? "/");
  const section = getSiteSection(pathname ?? "/");
  const [open, setOpen] = useState<string | null>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const hasMeasuredIndicator = useRef(false);
  const [indicator, setIndicator] = useState<{ left: number; top: number; width: number; height: number; animate: boolean } | null>(null);
  const [home] = getPrimaryNavigation(dictionary);
  const groups = getDesktopNavigationGroups(dictionary, roommatesEnabled);

  useLayoutEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const active = navigation.querySelector<HTMLAnchorElement>('a[data-primary-destination][aria-current="page"]');
      const bounds = navigation.getBoundingClientRect();
      const target = active?.getBoundingClientRect();
      if (!target || target.width === 0 || bounds.width === 0) {
        hasMeasuredIndicator.current = false;
        setIndicator(null);
        return;
      }
      const next = {
        left: target.left - bounds.left + navigation.scrollLeft - navigation.clientLeft,
        top: target.top - bounds.top + navigation.scrollTop - navigation.clientTop,
        width: target.width, height: target.height, animate: hasMeasuredIndicator.current,
      };
      setIndicator(current => current && current.left === next.left && current.top === next.top && current.width === next.width && current.height === next.height ? current : next);
      hasMeasuredIndicator.current = true;
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(navigation);
    navigation.querySelectorAll<HTMLAnchorElement>('a[data-primary-destination]').forEach(link => observer?.observe(link));
    window.addEventListener("resize", measure);
    void document.fonts?.ready.then(measure);
    return () => { disposed = true; observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [section, locale]);
  useEffect(() => { setOpen(null); }, [pathname]);
  useEffect(() => {
    const media = window.matchMedia?.("(max-width:899px)");
    if (!media) return;
    const closeCompact = () => { if (media.matches) setOpen(null); };
    media.addEventListener("change", closeCompact);
    return () => media.removeEventListener("change", closeCompact);
  }, []);

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(null);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, path: string) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.currentTarget.querySelector<HTMLAnchorElement>(":scope > a")?.focus();
      setOpen(null);
    }
    if (event.key === "ArrowDown" && event.target === event.currentTarget.firstElementChild) {
      event.preventDefault();
      const group = event.currentTarget;
      setOpen(path);
      window.requestAnimationFrame(() => group.querySelector<HTMLAnchorElement>(".m3-menu a")?.focus());
    }
  };
  return <nav ref={navigationRef} className="m3-desktop-navigation" aria-label={dictionary.navigation.mainNavigation}
    data-indicator-ready={indicator ? "true" : undefined}>
    <span className="m3-header-active-indicator" aria-hidden="true" data-animate={indicator?.animate ? "true" : "false"}
      style={indicator ? { width: indicator.width, height: indicator.height, opacity: 1, transform: `translate(${indicator.left}px, ${indicator.top}px)` } : { opacity: 0 }} />
    <Link href={localizePath("/", locale)} data-primary-destination aria-current={section === "/" ? "page" : undefined}>
      {home.label}
    </Link>
    {groups.map((group) => <div className="m3-nav-group" key={group.path}
      onMouseEnter={() => setOpen(group.path)}
      onMouseLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) setOpen(null); }}
      onFocus={() => setOpen(group.path)} onBlur={onBlur} onKeyDown={(event) => onKeyDown(event, group.path)}>
      <Link href={localizePath(group.path, locale)} data-primary-destination
        aria-current={section === group.path ? "page" : undefined} aria-expanded={open === group.path}
        aria-controls={open === group.path ? "m3-menu-" + group.path.slice(1) : undefined} onClick={() => setOpen(null)}>
        {group.label}
      </Link>
      {open === group.path && <div className="m3-menu" id={"m3-menu-" + group.path.slice(1)} aria-label={group.label}>
        {group.items.map(({ path, label, icon }) => path.startsWith("https:") ?
          <a key={path} href={path} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(null)}>
            <span className="m3-menu-label"><Icon name={icon} size={20} className="m3-menu-icon" /><span>{label}</span></span><span aria-hidden="true">↗</span>
          </a> :
          <Link key={path} href={localizePath(path, locale)} prefetch={false}
            aria-current={clean === path ? "page" : undefined} onClick={() => setOpen(null)}>
            <span className="m3-menu-label"><Icon name={icon} size={20} className="m3-menu-icon" /><span>{label}</span></span>
          </Link>)}
      </div>}
    </div>)}
  </nav>;
}

export const Header = memo(HeaderComponent);
