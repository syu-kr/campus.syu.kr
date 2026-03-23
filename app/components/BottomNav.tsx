"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Home, BookOpen, Building, MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  id: string;
}

const navItems: NavItem[] = [
  { id: "home", icon: Home, label: "홈", href: "/" },
  { id: "academic", icon: BookOpen, label: "학사", href: "/academic" },
  { id: "campus", icon: Building, label: "캠퍼스", href: "/campus" },
  { id: "more", icon: MoreHorizontal, label: "더보기", href: "/more" },
];

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/" && pathname === "/") return true;
    if (href !== "/" && pathname.startsWith(href)) return true;
    return false;
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 md:hidden"
      aria-label="메인 내비게이션"
    >
      <div className="grid grid-cols-4 gap-0">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={clsx(
                "flex flex-col items-center justify-center py-3 px-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset",
                active
                  ? "text-primary-600 font-semibold"
                  : "text-neutral-600 hover:text-neutral-900",
              )}
              aria-current={active ? "page" : undefined}
              title={item.label}
            >
              <IconComponent size={24} aria-hidden="true" />
              <div className="text-xs mt-1">{item.label}</div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
