"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBackClick?: () => void;
}

const navItems = [
  { label: "학사", href: "/academic" },
  { label: "캠퍼스", href: "/campus" },
  { label: "등록금", href: "/tuition" },
  { label: "더보기", href: "/more" },
];

export function Header({
  title = "SYU CAMPUS",
  showBack = false,
  onBackClick,
}: HeaderProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/" && pathname === "/") return true;
    if (href !== "/" && pathname.startsWith(href)) return true;
    return false;
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
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
          <Link href="/" className="flex items-center gap-2">
            <div className="font-bold text-lg text-primary-600">{title}</div>
          </Link>
        </div>

        {/* 데스크톱 네비게이션 */}
        <nav className="hidden md:flex items-center gap-1">
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
      </div>
    </header>
  );
}

export default Header;
