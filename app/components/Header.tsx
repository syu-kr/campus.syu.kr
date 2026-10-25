"use client";

import { memo, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
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
import { getPrimaryNavigation } from "./site-navigation";
import { useDictionary, useLocale } from "./LocaleProvider";

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
  const academic = dictionary.academic.menus, campus = dictionary.campus.menus, more = dictionary.more.menus;
  const [home, academicNav, campusNav, moreNav] = getPrimaryNavigation(dictionary);
  const groups = [
    { ...academicNav, items: [
      ["/academic/announcements", academic.announcementsTitle], ["/academic/schedule", academic.scheduleTitle],
      ["/academic/sw-notices", academic.swNoticesTitle], ["/academic/competitions", academic.competitionsTitle],
      ["/academic/scholarship", academic.scholarshipTitle], ["/academic/graduation", academic.graduationTitle],
      ["/academic/timetable", academic.timetableTitle], ["https://sugang.syu.kr/testLogin", academic.mockSugangTitle],
      ["https://sugang.syu.kr/basket", academic.basketCompetitionTitle],
    ] },
    { ...campusNav, items: [
      ...(roommatesEnabled ? [["/campus/roommates", campus.roommatesTitle]] : []),
      ["/campus/announcements", campus.announcementsTitle], ["/campus/cafeteria", campus.cafeteriaTitle],
      ["/campus/bus-info", campus.busTitle], ["/campus/library", campus.libraryTitle], ["/campus/map", campus.mapTitle],
      ["/campus/phone", campus.phoneTitle], ["/campus/campus-tips", campus.campusTipsTitle],
      ["/campus/gym", campus.gymTitle], ["/campus/health-center", campus.healthCenterTitle],
    ] },
    { ...moreNav, items: [
      ["/service/notices", more.serviceTitle], ["/more/meet", more.meetTitle], ["/more/privacy", more.privacyTitle],
    ] },
  ];
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
  return <nav className="m3-desktop-navigation" aria-label={dictionary.navigation.mainNavigation}>
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
        {group.items.map(([path, label]) => path.startsWith("https:") ?
          <a key={path} href={path} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(null)}>
            {label}<span aria-hidden="true">↗</span>
          </a> :
          <Link key={path} href={localizePath(path, locale)} prefetch={false}
            aria-current={clean === path ? "page" : undefined} onClick={() => setOpen(null)}>{label}</Link>)}
      </div>}
    </div>)}
  </nav>;
}

export const Header = memo(HeaderComponent);
