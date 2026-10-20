"use client";

import { type MouseEvent, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button, buttonStyles } from "@/app/components/Button";
import { Card } from "@/app/components/Card";
import { Icon } from "@/app/components/Icon";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { localizePath } from "@/lib/i18n/routing";
import { takePwaInstallPrompt } from "@/lib/pwa-install";

const PWA_INSTALL_DISMISSED_KEY = "syu-campus:pwa-install-dismissed";
const FREQUENT_MENU_ICON_COLOR = "rgb(37, 99, 235)";
const FREQUENT_MENU_ICON_SIZE = 32;
const FREQUENT_MENU_COMPACT_ICON_SIZE = 36;
const FREQUENT_MENU_ICON_STROKE_WIDTH = 1.85;
const InstallHelpModal = dynamic(() =>
  import("@/app/components/Modal").then((module) => module.Modal),
);

export function FrequentMenuGrid() {
  const locale = useLocale();
  const dictionary = useDictionary();
  const frequentMenus = [
    {
      id: "1",
      iconName: "utensils",
      iconSize: FREQUENT_MENU_COMPACT_ICON_SIZE,
      label: dictionary.home.menu.cafeteria,
      path: "/campus/cafeteria",
    },
    {
      id: "2",
      iconName: "book-open",
      label: dictionary.home.menu.library,
      path: "/campus/library",
    },
    {
      id: "3",
      iconName: "award",
      iconSize: FREQUENT_MENU_COMPACT_ICON_SIZE,
      label: dictionary.academic.menus.graduationTitle,
      path: "/academic/graduation",
    },
    {
      id: "4",
      iconName: "bus",
      label: dictionary.home.menu.bus,
      path: "/campus/bus-info",
    },
    {
      id: "5",
      iconName: "lightbulb",
      iconSize: FREQUENT_MENU_COMPACT_ICON_SIZE,
      label: dictionary.home.menu.campusTips,
      path: "/campus/campus-tips",
    },
    {
      id: "6",
      iconName: "map",
      label: dictionary.home.menu.map,
      path: "/campus/map",
    },
  ];

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-neutral-700">
        {dictionary.home.frequentMenuTitle}
      </h2>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {frequentMenus.map((menu) => (
          <Link
            key={menu.id}
            href={localizePath(menu.path, locale)}
            className="flex flex-col items-center justify-center rounded-lg py-4 transition-colors hover:bg-primary-50"
          >
            <Icon
              name={menu.iconName}
              size={menu.iconSize ?? FREQUENT_MENU_ICON_SIZE}
              color={FREQUENT_MENU_ICON_COLOR}
              strokeWidth={FREQUENT_MENU_ICON_STROKE_WIDTH}
              className="mb-2 flex h-9 w-9 items-center justify-center"
            />
            <span className="text-center text-xs font-medium text-neutral-900">
              {menu.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function PwaInstallCard() {
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const installTrigger = useRef<HTMLButtonElement | null>(null);
  const dictionary = useDictionary();
  const locale = useLocale();

  useEffect(() => {
    const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone;
    setIsVisible(!isStandalone && localStorage.getItem(PWA_INSTALL_DISMISSED_KEY) !== "true");

    const handleInstalled = () => {
      setShowInstallHelp(false);
      setIsVisible(false);
    };
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const handleInstall = async (event: MouseEvent<HTMLButtonElement>) => {
    installTrigger.current = event.currentTarget;
    // The app captures this event before the deferred dashboard mounts; consume it once.
    const prompt = takePwaInstallPrompt();
    if (!prompt) {
      setShowInstallHelp(true);
      return;
    }
    setIsInstalling(true);
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") setIsVisible(false);
    } catch {
      setShowInstallHelp(true);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(PWA_INSTALL_DISMISSED_KEY, "true");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <>
    <Card className="border border-primary-100 bg-primary-50" hover={false}>
      <div className="flex items-start gap-3">
        <Icon
          name="info"
          size={20}
          color="rgb(37, 99, 235)"
          className="mt-0.5 flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">
            {dictionary.home.pwaTitle}
          </p>
          <p className="mt-1 text-xs leading-5 text-neutral-600">
            {dictionary.home.pwaDescription}
          </p>
          <Button
            variant="secondary"
            className="mt-3 text-xs"
            onClick={handleInstall}
            disabled={isInstalling}
            aria-busy={isInstalling}
          >
            {dictionary.home.pwaAction}
          </Button>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-white hover:text-neutral-900"
          aria-label={dictionary.home.dismissPwa}
        >
          <Icon name="x" size={16} color="currentColor" />
        </button>
      </div>
    </Card>
    {showInstallHelp && (
      <InstallHelpModal
        isOpen
        title={dictionary.home.pwaAction}
        description={dictionary.home.pwaInstallHelp}
        onClose={() => {
          setShowInstallHelp(false);
          window.requestAnimationFrame(() => installTrigger.current?.focus());
        }}
        size="sm"
      >
        <ul className="space-y-3 text-sm leading-6 text-neutral-700">
          <li>{dictionary.home.pwaInstallIos}</li>
          <li>{dictionary.home.pwaInstallBrowser}</li>
        </ul>
        <Link
          href={localizePath("/service/notices/005-pwa-installation-guide", locale)}
          className={buttonStyles("secondary", "mt-4")}
        >
          {dictionary.home.pwaInstallGuide}
        </Link>
      </InstallHelpModal>
    )}
    </>
  );
}

export function RelatedLinksSection() {
  const locale = useLocale();
  const dictionary = useDictionary();
  const relatedLinks = [
    {
      iconName: "book-open",
      title: dictionary.home.links.academicTitle,
      description: dictionary.home.links.academicDescription,
      path: "/academic",
    },
    {
      iconName: "building",
      title: dictionary.home.links.campusTitle,
      description: dictionary.home.links.campusDescription,
      path: "/campus",
    },
    {
      iconName: "more-horizontal",
      title: dictionary.home.links.moreTitle,
      description: dictionary.home.links.moreDescription,
      path: "/more",
    },
    {
      iconName: "megaphone",
      title: dictionary.home.links.serviceTitle,
      description: dictionary.home.links.serviceDescription,
      path: "/service/notices",
    },
  ];

  return (
    <div className="mt-8 border-t border-neutral-200 pt-6">
      <h2 className="mb-4 text-lg font-semibold text-neutral-900">
        {dictionary.home.relatedLinksTitle}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {relatedLinks.map((link) => (
          <Link
            key={link.path}
            href={localizePath(link.path, locale)}
            className="rounded-lg border border-neutral-200 p-4 transition-all hover:border-primary-500 hover:bg-primary-50"
          >
            <Icon
              name={link.iconName}
              size={24}
              color="rgb(37, 99, 235)"
              className="mb-2"
            />
            <p className="text-sm font-medium text-neutral-900">{link.title}</p>
            <p className="text-xs text-neutral-600">{link.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
