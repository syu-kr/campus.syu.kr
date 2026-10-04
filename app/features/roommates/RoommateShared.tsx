"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/app/components/LocaleProvider";
import { localizePath, stripLocalePrefix } from "@/lib/i18n";
import { getRoommateText, type RoommateText } from "@/lib/i18n/roommates";
import type { RoommateHabits, RoommatePostSummary } from "@/types/roommates";
import { ROOMMATE_HABIT_OPTIONS } from "@/lib/roommates";

export const inputClass = "mt-1 min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-neutral-100";
export const primaryClass = "inline-flex min-h-11 items-center justify-center rounded-lg bg-primary-600 px-4 py-2 font-medium text-white hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:opacity-50";
export const secondaryClass = "inline-flex min-h-11 items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-primary-500 disabled:opacity-50";

export function RoommateHeading({ children, navigationEnabled = true }: { children: ReactNode; navigationEnabled?: boolean }) {
  const locale = useLocale(); const text = getRoommateText(locale);
  const pathname = stripLocalePrefix(usePathname());
  const title = pathname === "/campus/roommates/new" ? text.create : pathname === "/campus/roommates/me" ? text.mine : text.title;
  const links = [
    { href: "/campus/roommates", label: text.list },
    { href: "/campus/roommates/me", label: text.mine },
    { href: "/campus/roommates/new", label: text.create },
  ];
  return <header className="mb-6">
    <Link href={localizePath("/campus", locale)} className="inline-flex min-h-11 items-center gap-1 text-sm text-neutral-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"><span aria-hidden="true">‹</span>{text.campus}</Link>
    <h1 className="mt-2 text-2xl font-bold text-neutral-900 sm:text-3xl">{title}</h1>
    <p className="mt-2 text-neutral-600">{text.description}</p>
    <div className="mt-4 flex items-start justify-between gap-3">
    <nav aria-label={text.title} className="flex flex-wrap gap-x-5 gap-y-1 sm:gap-x-6">
      {links.map(({ href, label }) => {
        const className = `inline-flex min-h-11 items-center py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-500 sm:text-base ${pathname === href ? "text-primary-700 underline decoration-2 underline-offset-8" : "text-neutral-500 hover:text-neutral-900"}`;
        return navigationEnabled ? <Link key={href} prefetch={false} href={localizePath(href, locale)} aria-current={pathname === href ? "page" : undefined} className={className}>{label}</Link>
          : <span key={href} aria-disabled="true" className={className}>{label}</span>;
      })}
    </nav>
    <div className="shrink-0">{children}</div>
    </div>
  </header>;
}

export function postTitle(post: Pick<RoommatePostSummary, "dorm" | "roomSize" | "roommatesNeeded">, text: RoommateText): string {
  return text.titleTemplate.replace("{dorm}", text.dorms[post.dorm]).replace("{size}", String(post.roomSize)).replace("{people}", String(post.roommatesNeeded));
}

export function HabitValues({ habits }: { habits: RoommateHabits }) {
  const text = getRoommateText(useLocale());
  return <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">{Object.keys(ROOMMATE_HABIT_OPTIONS).map((key) => {
    const field = key as keyof RoommateHabits; const value = habits[field]; const values = value ? (Array.isArray(value) ? value : [value]) : [];
    return <div key={field} className="rounded-lg bg-neutral-50 px-3 py-2"><dt className="text-sm text-neutral-500">{text.habitLabels[field]}</dt><dd className="mt-1 font-medium text-neutral-800">{values.length ? values.map((option) => text.options[option as keyof typeof text.options]).join(", ") : text.unspecified}</dd></div>;
  })}</dl>;
}

export function HabitSummary({ habits }: { habits: RoommateHabits }) {
  const text = getRoommateText(useLocale());
  const entries = Object.keys(ROOMMATE_HABIT_OPTIONS).flatMap((key) => {
    const field = key as keyof RoommateHabits; const value = habits[field];
    const values = value ? (Array.isArray(value) ? value : [value]) : [];
    return values.map((option) => ({ key: `${field}:${option}`, label: `${text.habitLabels[field]}: ${text.options[option as keyof typeof text.options]}` }));
  }).slice(0, 4);
  if (!entries.length) return null;
  return <ul aria-label={text.habits} className="mt-3 flex flex-wrap gap-2">{entries.map((entry) => <li key={entry.key} className="rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-700">{entry.label}</li>)}</ul>;
}

export function HabitFields({ value, onChange, emptyLabel }: { value: RoommateHabits; onChange: (value: RoommateHabits) => void; emptyLabel?: string }) {
  const text = getRoommateText(useLocale());
  return <div className="grid gap-4 sm:grid-cols-2">{Object.entries(ROOMMATE_HABIT_OPTIONS).map(([key, options]) => {
    const field = key as keyof RoommateHabits;
    if (field === "sleepHabits" || field === "temperature") {
      const selected = value[field] ?? [];
      return <fieldset key={field} className="rounded-lg border border-neutral-200 p-3"><legend className="px-1 text-sm font-medium">{text.habitLabels[field]}</legend><div className="flex flex-wrap gap-x-4 gap-y-2">{options.map((option) => <label key={option} className="inline-flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={(selected as readonly string[]).includes(option)} onChange={(event) => {
        let next = (selected as readonly string[]).filter((item) => item !== option);
        if (event.target.checked) { next = field === "sleepHabits" && (option === "none" || option === "unknown") ? [option] : [...next.filter((item) => field !== "sleepHabits" || (item !== "none" && item !== "unknown")), option]; }
        onChange({ ...value, [field]: next });
      }} className="h-4 w-4 accent-primary-600" />{text.options[option]}</label>)}</div></fieldset>;
    }
    return <label key={field} className="text-sm font-medium">{text.habitLabels[field]}<select name={`habits.${field}`} value={value[field] ?? ""} className={inputClass} onChange={(event) => { const next = { ...value }; if (event.target.value) (next as Record<string, unknown>)[field] = event.target.value; else delete next[field]; onChange(next); }}><option value="">{emptyLabel ?? text.unspecified}</option>{options.map((option) => <option key={option} value={option}>{text.options[option]}</option>)}</select></label>;
  })}</div>;
}
