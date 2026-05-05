"use client";

import React, { memo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { WeatherWidget } from "./WeatherWidget";
import { WeatherModal } from "./WeatherModal";
import { fetchWeather, type WeatherData } from "@/lib/weather";
import { Icon } from "./Icon";

interface HeaderProps {
  showBack?: boolean;
  onBackClick?: () => void;
}

const navItems = [
  { label: "학사", href: "/academic" },
  { label: "캠퍼스", href: "/campus" },
  { label: "더보기", href: "/more" },
];

function HeaderComponent({ showBack = false, onBackClick }: HeaderProps) {
  const pathname = usePathname();
  const [weatherModalOpen, setWeatherModalOpen] = useState(false);
  const [translateModalOpen, setTranslateModalOpen] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);

  const handleWeatherClick = async () => {
    const data = await fetchWeather();
    setWeatherData(data);
    setWeatherModalOpen(true);
  };

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/" && pathname === "/") return true;
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
                onClick={onBackClick || (() => window.history.back())}
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                aria-label="뒤로가기"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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
              href="/"
              className="flex items-center gap-2"
              title="홈페이지로 이동"
            >
              <Image
                src="/images/syu-kr-logo.png"
                alt="삼육대학교 캠퍼스 통합 정보 플랫폼 로고 - 홈페이지로 이동"
                width={32}
                height={32}
                className="object-contain"
                loading="lazy"
                priority={false}
              />
              <span className="font-bold text-lg text-primary-600">
                SYU CAMPUS
              </span>
            </Link>
          </div>

          <div className="md:hidden flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTranslateModalOpen(true)}
              className="h-9 px-3 rounded-full border border-primary-200 bg-primary-50 text-xs font-semibold text-primary-700 hover:bg-primary-100 transition-colors"
              aria-label="번역 안내 열기"
            >
              Translate
            </button>
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
                    isActive(item.href)
                      ? "bg-primary-600 text-white"
                      : "text-neutral-700 hover:bg-neutral-100",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="my-2 w-px h-6 bg-neutral-200" />
            <button
              type="button"
              onClick={() => setTranslateModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-primary-200 bg-primary-50 text-sm font-semibold text-primary-700 hover:bg-primary-100 transition-colors"
              aria-label="번역 안내 열기"
            >
              <Icon name="info" size={16} color="currentColor" />
              Translate
            </button>
            <WeatherWidget onClick={handleWeatherClick} />
          </div>
        </div>
      </header>

      <TranslationHelpModal
        isOpen={translateModalOpen}
        onClose={() => setTranslateModalOpen(false)}
      />

      <WeatherModal
        isOpen={weatherModalOpen}
        weather={weatherData}
        onClose={() => setWeatherModalOpen(false)}
      />
    </>
  );
}

function TranslationHelpModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleOpenInBrowser = () => {
    window.open(window.location.href, "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4 pt-16 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="translation-help-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
              Translation
            </p>
            <h2
              id="translation-help-title"
              className="mt-1 text-lg font-bold text-neutral-900"
            >
              브라우저 번역 기능 사용하기
            </h2>
            <p className="mt-1 text-sm font-medium text-neutral-600">
              Use your browser&apos;s built-in translation
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
            aria-label="번역 안내 닫기"
          >
            <Icon name="x" size={20} color="currentColor" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <h3 className="text-sm font-bold text-neutral-900">한국어 안내</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-700">
              번역을 이용한 원활한 사이트 이용을 위해 이 사이트는 사용자의
              브라우저 내 자체 번역 기능을 사용합니다. 아래 사항을 따라 번역을
              켠 뒤 원하는 언어를 선택하세요.
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-700">
              <li>Chrome / Edge: 주소창의 번역 아이콘 또는 메뉴에서 번역 선택</li>
              <li>Safari: 주소창의 aA 버튼에서 Translate 선택</li>
              <li>번역 언어 목록에서 원하는 언어를 선택</li>
            </ul>
          </section>

          <section className="rounded-xl border border-primary-100 bg-primary-50 p-4">
            <h3 className="text-sm font-bold text-neutral-900">
              English Guide
            </h3>
            <p className="mt-2 text-sm leading-6 text-neutral-700">
              To use this site smoothly with translation, we use your
              browser&rsquo;s built-in translation feature. Follow the steps
              below, turn on translation, and choose your preferred language.
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-700">
              <li>Chrome / Edge: use the translate icon or browser menu</li>
              <li>Safari: open the aA menu and choose Translate</li>
              <li>Select the language you want from the translation menu</li>
            </ul>
          </section>

          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-bold text-neutral-900">
              PWA 앱에서 사용 중이라면
            </h3>
            <p className="mt-2 text-sm leading-6 text-neutral-700">
              PWA 앱 화면에서는 브라우저 주소창과 번역 메뉴가 보이지 않을 수
              있습니다. 이 경우 현재 페이지를 브라우저에서 연 뒤 번역 기능을
              사용하세요.
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-700">
              If you are using the PWA app, browser translation controls may not
              be visible. Open this page in your browser, then use the browser
              translation menu.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleOpenInBrowser}
                className="rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors"
              >
                브라우저에서 열기 / Open
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 transition-colors"
              >
                {copied ? "복사됨 / Copied" : "링크 복사 / Copy link"}
              </button>
            </div>
          </section>
        </div>

        <div className="border-t border-neutral-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
          >
            확인 / Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export const Header = memo(HeaderComponent);

export default Header;
