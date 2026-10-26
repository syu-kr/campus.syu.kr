import type { Metadata } from "next";
import { getDictionary, localizePath, type Locale } from "./i18n";

const SITE_ORIGIN = "https://campus.syu.kr";
const SOCIAL_IMAGE = "/images/syu-campus-app-icon-512-m3-smile.png";

export function createPageMetadata({
  title,
  description,
  pathname,
  locale,
  contentLocale = locale,
  type = "website",
}: {
  title: string;
  description: string;
  pathname: string;
  locale: Locale;
  contentLocale?: Locale;
  type?: "website" | "article";
}): Metadata {
  // Nested metadata replaces the parent's whole object, so include shared fields here.
  return {
    title,
    description,
    openGraph: {
      type,
      locale: getDictionary(contentLocale).meta.openGraphLocale,
      url: new URL(localizePath(pathname, locale), SITE_ORIGIN).href,
      siteName: "SYU CAMPUS",
      title,
      description,
      images: [{ url: SOCIAL_IMAGE, width: 512, height: 512, alt: "SYU CAMPUS" }],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [SOCIAL_IMAGE],
    },
  };
}
