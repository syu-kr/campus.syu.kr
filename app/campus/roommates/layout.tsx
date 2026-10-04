import type { Metadata } from "next";
import { headers } from "next/headers";
import { LOCALE_HEADER_NAME, normalizeLocale } from "@/lib/i18n";
import { getRoommateText } from "@/lib/i18n/roommates";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const text = getRoommateText(normalizeLocale((await headers()).get(LOCALE_HEADER_NAME)));
  return { title: `${text.title} | SYU CAMPUS`, description: text.description, robots: { index: false, follow: false }, openGraph: { title: text.title, description: text.description }, twitter: { title: text.title, description: text.description } };
}
export default function RoommateLayout({ children }: { children: React.ReactNode }) { return children; }
