"use client";

import { memo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { WeatherWidget } from "./WeatherWidget";
import { WeatherModal } from "./WeatherModal";
import { fetchWeather, type WeatherData } from "@/lib/weather";
import { localizePath } from "@/lib/i18n";
import { useDictionary, useLocale } from "./LocaleProvider";

interface HeaderProps {
  showBack?: boolean;
  onBackClick?: () => void;
}

function HeaderComponent({ showBack = false, onBackClick }: HeaderProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const dictionary = useDictionary();
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
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {showBack && (
              <button
                type="button"
                onClick={onBackClick || (() => window.history.back())}
                className="rounded-lg p-2 transition-colors hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                aria-label={dictionary.navigation.back}
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
              </button>
            )}
            <Link
              href={localizePath("/", locale)}
              className="flex items-center gap-2"
              title={dictionary.navigation.homepageTitle}
            >
              <Image
                src="/images/syu-kr-logo.png"
                alt={dictionary.navigation.logoAlt}
                width={32}
                height={32}
                className="object-contain"
                priority
              />
              <span className="font-bold text-lg text-primary-600">
                SYU CAMPUS
              </span>
            </Link>
          </div>

          <div className="md:hidden flex items-center gap-2">
            <WeatherWidget onClick={handleWeatherClick} />
          </div>

          <div className="hidden md:flex items-center gap-3">
            <nav className="flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive(item.activePath)
                      ? "bg-primary-600 text-white"
                      : "text-neutral-700 hover:bg-neutral-100",
                  )}
                >
                  {item.label}
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
