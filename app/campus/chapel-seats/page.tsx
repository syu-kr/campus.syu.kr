import type { Metadata } from "next";
import { headers } from "next/headers";
import ChapelSeatsPageClient from "@/app/features/chapel-seats/ChapelSeatsPageClient";
import { getDictionary } from "@/lib/i18n";
import { LOCALE_HEADER_NAME, normalizeLocale } from "@/lib/i18n/routing";
import { createPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = normalizeLocale((await headers()).get(LOCALE_HEADER_NAME));
  const menus = getDictionary(locale).campus.menus;
  return createPageMetadata({
    title: `${menus.chapelSeatsTitle} | SYU CAMPUS`,
    description: menus.chapelSeatsDescription,
    pathname: "/campus/chapel-seats",
    locale,
  });
}

export default function ChapelSeatsPage() {
  return <ChapelSeatsPageClient />;
}
