"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { NavigationPendingIndicator } from "./NavigationPendingIndicator";
import { useDictionary, useLocale } from "./LocaleProvider";
import { localizePath } from "@/lib/i18n/routing";
import { getSiteSection } from "@/lib/site-presentation";
import { getPrimaryNavigation } from "./site-navigation";

export function BottomNav() {
  const pathname = usePathname(), locale = useLocale(), dictionary = useDictionary();
  const section = getSiteSection(pathname ?? "/");
  const items = getPrimaryNavigation(dictionary);
  return <nav className="m3-bottom-nav" aria-label={dictionary.navigation.mainNavigation}>
    {items.map((item) => <Link key={item.path} href={localizePath(item.path, locale)} data-primary-destination
      aria-current={section === item.path ? "page" : undefined}>
      <span className="m3-nav-content">
        <span className="m3-nav-indicator" aria-hidden="true"><Icon name={item.icon} size={24}
          strokeWidth={section === item.path ? 2.6 : 1.8} /></span>
        <span className="m3-nav-label">{item.label}</span>
      </span>
      <NavigationPendingIndicator className="inset-x-4 top-0 bg-primary-500" />
    </Link>)}
  </nav>;
}
