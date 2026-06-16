import { Card } from "@/app/components/Card";
import Link from "next/link";
import type { ReactNode } from "react";

interface LegalPageHeaderProps {
  title: string;
  description: string;
  homeHref?: string;
  homeLabel?: string;
  noticeTitle?: string;
  notice: string;
  noticeTone?: "blue" | "red";
}

interface LegalSectionProps {
  title: string;
  children: ReactNode;
}

const noticeToneClass = {
  blue: "bg-blue-50 border-blue-200 text-blue-900 [&_p:last-child]:text-blue-800",
  red: "bg-red-50 border-red-200 text-red-900 [&_p:last-child]:text-red-800",
};

export function LegalPageHeader({
  title,
  description,
  homeHref = "/",
  homeLabel = "홈으로",
  noticeTitle,
  notice,
  noticeTone = "blue",
}: LegalPageHeaderProps) {
  return (
    <div className="mb-8">
      <Link
        href={homeHref}
        className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-4 transition-colors"
      >
        <svg
          className="w-4 h-4"
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
        {homeLabel}
      </Link>
      <h1 className="text-3xl font-bold text-neutral-900 mb-2">{title}</h1>
      <p className="text-neutral-600">{description}</p>
      <div
        className={`mt-4 p-4 border rounded-lg ${noticeToneClass[noticeTone]}`}
      >
        {noticeTitle && (
          <p className="text-sm font-semibold mb-2">{noticeTitle}</p>
        )}
        <p className="text-sm">{notice}</p>
      </div>
    </div>
  );
}

export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <Card>
      <h2 className="text-xl font-bold text-neutral-900 mb-4">{title}</h2>
      {children}
    </Card>
  );
}
