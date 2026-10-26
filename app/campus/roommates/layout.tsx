import type { Metadata } from "next";
import { headers } from "next/headers";
import { LOCALE_HEADER_NAME, normalizeLocale } from "@/lib/i18n";
import { getRoommateText } from "@/lib/i18n/roommates";
import { createPageMetadata } from "@/lib/page-metadata";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const locale = normalizeLocale((await headers()).get(LOCALE_HEADER_NAME));
  const text = getRoommateText(locale);
  return {
    ...createPageMetadata({ title: `${text.title} | SYU CAMPUS`, description: text.description, pathname: "/campus/roommates", locale }),
    robots: { index: false, follow: false },
  };
}
export default function RoommateLayout({ children }: { children: React.ReactNode }) { return children; }
