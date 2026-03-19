"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

interface NavItem {
  icon: string;
  label: string;
  href: string;
  id: string;
}

const navItems: NavItem[] = [
  { id: "home", icon: "🏠", label: "홈", href: "/" },
  { id: "academic", icon: "📚", label: "학사", href: "/academic" },
  { id: "campus", icon: "🏫", label: "캠퍼스", href: "/campus" },
  { id: "more", icon: "⋯", label: "더보기", href: "/more" },
];

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/" && pathname === "/") return true;
    if (href !== "/" && pathname.startsWith(href)) return true;
    return false;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 md:hidden">
      <div className="grid grid-cols-4 gap-0">
        {navItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={clsx(
              "flex flex-col items-center justify-center py-3 px-2 transition-colors",
              isActive(item.href)
                ? "text-primary-600 font-semibold"
                : "text-neutral-600 hover:text-neutral-900",
            )}
          >
            <div className="text-2xl">{item.icon}</div>
            <div className="text-xs mt-1">{item.label}</div>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export default BottomNav;
