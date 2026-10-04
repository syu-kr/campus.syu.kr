"use client";

import { memo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { WeatherWidget } from "./WeatherWidget";
import { WeatherModal } from "./WeatherModal";
import { NavigationPendingIndicator } from "./NavigationPendingIndicator";
import { fetchWeather, type WeatherData } from "@/lib/weather";
import { localizePath } from "@/lib/i18n";
import { getParentPageHref } from "@/lib/page-navigation";
import { getRoommateText } from "@/lib/i18n/roommates";
import { useDictionary, useLocale } from "./LocaleProvider";
import { buttonStyles } from "./Button";

function HeaderComponent() {
  const pathname = usePathname();
  const locale = useLocale();
  const dictionary = useDictionary();
  const backHref = getParentPageHref(pathname);
  const parentLabels: Record<string, string> = {
    "/": dictionary.navigation.home,
    "/academic": dictionary.navigation.academic,
    "/campus": dictionary.navigation.campus,
    "/more": dictionary.navigation.more,
    "/announcements": dictionary.pages.announcements.allTitle,
    "/service/notices": dictionary.pages.serviceNotices.title,
    "/more/meet": dictionary.pages.meet.title,
    "/campus/campus-tips": dictionary.pages.campusTips.title,
    "/campus/roommates": getRoommateText(locale).title,
    "/campus/roommates/verify": getRoommateText(locale).verifyTitle,
  };
  const [weatherModalOpen, setWeatherModalOpen] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const navItems = [
    {
      label: dictionary.navigation.academic,
      href: localizePath("/academic", locale),
      activePath: "/academic",
    },
    {
      label: dictionary.navigation.campus,
      href: localizePath("/campus", locale),
      activePath: "/campus",
    },
    {
      label: dictionary.navigation.more,
      href: localizePath("/more", locale),
      activePath: "/more",
    },
  ];

  const handleWeatherClick = async () => {
    const data = await fetchWeather();
    setWeatherData(data);
    setWeatherModalOpen(true);
  };

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/" && pathname === "/") return true;
    if (href !== "/" && pathname.startsWith(localizePath(href, locale))) {
      return true;
    }
    if (href !== "/" && pathname.startsWith(href)) return true;
    return false;
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
        <div className="min-h-16 max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {backHref && (
              <Link
                href={localizePath(backHref, locale)}
                prefetch={false}
                className={buttonStyles("ghost", "relative w-11 shrink-0 overflow-hidden px-0")}
                aria-label={`${dictionary.navigation.back}: ${parentLabels[backHref]}`}
                title={`${dictionary.navigation.back}: ${parentLabels[backHref]}`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                <NavigationPendingIndicator className="inset-x-2 bottom-1 bg-primary-500" />
              </Link>
            )}
            <Link
              href={localizePath("/", locale)}
              className="relative flex min-w-0 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              aria-label={dictionary.navigation.homepageTitle}
              title={dictionary.navigation.homepageTitle}
            >
              <Image
                src="/images/syu-campus-brand-badge-v1.png"
                alt={dictionary.navigation.logoAlt}
                width={32}
                height={32}
                className="shrink-0 object-contain"
                priority
              />
              <span className={clsx(
                "min-w-0 truncate font-bold text-base sm:text-lg text-primary-600",
                backHref && "hidden min-[360px]:inline",
              )}>
                SYU CAMPUS
              </span>
              <NavigationPendingIndicator className="-bottom-2 inset-x-4 bg-primary-500" />
            </Link>
          </div>

          <div className="md:hidden flex shrink-0 items-center gap-2">
            <WeatherWidget onClick={handleWeatherClick} />
          </div>

          <div className="hidden md:flex items-center gap-3">
            <nav className="flex items-center gap-1" aria-label={dictionary.navigation.mainNavigation}>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={buttonStyles(
                    isActive(item.activePath) ? "primary" : "ghost",
                    "relative overflow-hidden text-sm",
                  )}
                  aria-current={isActive(item.activePath) ? "page" : undefined}
                >
                  {item.label}
                  <NavigationPendingIndicator
                    className={clsx(
                      "inset-x-3 bottom-1",
                      isActive(item.activePath)
                        ? "bg-white"
                        : "bg-primary-500",
                    )}
                  />
                </Link>
              ))}
            </nav>
            <div className="my-2 w-px h-6 bg-neutral-200" />
            <WeatherWidget onClick={handleWeatherClick} />
          </div>
        </div>
      </header>

      <WeatherModal
        isOpen={weatherModalOpen}
        weather={weatherData}
        onClose={() => setWeatherModalOpen(false)}
      />
    </>
  );
}

export const Header = memo(HeaderComponent);
