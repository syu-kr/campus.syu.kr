"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Icon } from "./Icon";
import { useDictionary, useLocale } from "./LocaleProvider";
import { localizePath } from "@/lib/i18n";

interface NavItem {
  iconName: string;
  label: string;
  href: string;
  id: string;
}

export function BottomNav() {
  const pathname = usePathname();
  const locale = useLocale();
  const dictionary = useDictionary();
  const navItems: NavItem[] = [
    {
      id: "home",
      iconName: "home",
      label: dictionary.navigation.home,
      href: "/",
    },
    {
      id: "academic",
      iconName: "book-open",
      label: dictionary.navigation.academic,
      href: "/academic",
    },
    {
      id: "campus",
      iconName: "building",
      label: dictionary.navigation.campus,
      href: "/campus",
    },
    {
      id: "more",
      iconName: "more-horizontal",
      label: dictionary.navigation.more,
      href: "/more",
    },
  ];

  const isActive = (href: string) => {
    if (!pathname) return false;
    const localizedHref = localizePath(href, locale);
    if (href === "/" && pathname === localizedHref) return true;
    if (href !== "/" && pathname.startsWith(localizedHref)) return true;
    return false;
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 md:hidden"
      aria-label={dictionary.navigation.mainNavigation}
    >
      <div className="grid grid-cols-4 gap-0">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={localizePath(item.href, locale)}
              className={clsx(
                "flex flex-col items-center justify-center py-3 px-2 transition-colors",
                active
                  ? "text-primary-600 font-semibold"
                  : "text-neutral-600 hover:text-neutral-900",
              )}
              aria-current={active ? "page" : undefined}
              title={item.label}
            >
              <Icon
                name={item.iconName}
                size={24}
                color="currentColor"
                title={item.label}
              />
              <div className="text-xs mt-1">{item.label}</div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
