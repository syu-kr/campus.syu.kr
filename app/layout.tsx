import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { BottomNav } from "./components/BottomNav";
import { LocaleProvider } from "./components/LocaleProvider";
import { StructuredDataScript } from "./components/StructuredDataScript";
import { Providers } from "./providers";
import {
  LOCALE_HEADER_NAME,
  PATHNAME_HEADER_NAME,
  getDictionary,
  localizePath,
  normalizeLocale,
  stripLocalePrefix,
  type Locale,
} from "@/lib/i18n";
import { createWebSiteSchema } from "@/lib/structured-data";
import "./globals.css";

// Pretendard 폰트 import - 필요한 weight만 로드
import "@fontsource/pretendard/400.css"; // Regular
import "@fontsource/pretendard/500.css"; // Medium
import "@fontsource/pretendard/600.css"; // Semibold
import "@fontsource/pretendard/700.css"; // Bold

const GOOGLE_ANALYTICS_ID = "G-SD8QFQWFVQ";
const GOOGLE_ANALYTICS_SCRIPT = `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GOOGLE_ANALYTICS_ID}');
`;
const CSP_NONCE_HEADER_NAME = "x-csp-nonce";

async function getRequestLocale(): Promise<Locale> {
  const headerStore = await headers();
  return normalizeLocale(headerStore.get(LOCALE_HEADER_NAME));
}

async function getRequestPathname(): Promise<string> {
  const headerStore = await headers();
  return headerStore.get(PATHNAME_HEADER_NAME) || "/";
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const pathname = await getRequestPathname();
  const dictionary = getDictionary(locale);
  const canonicalPath = localizePath(stripLocalePrefix(pathname), locale);
  const koreanPath = stripLocalePrefix(pathname);
  const englishPath = localizePath(koreanPath, "en");

  return {
    metadataBase: new URL("https://campus.syu.kr"),
    applicationName: "SYU CAMPUS",
    title: {
      template: "%s",
      default: dictionary.meta.title,
    },
    description: dictionary.meta.description,
    keywords: dictionary.meta.keywords,
    authors: [{ name: "SYU KR" }],
    alternates: {
      canonical: canonicalPath,
      languages: {
        ko: koreanPath,
        en: englishPath,
        "x-default": koreanPath,
      },
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      type: "website",
      locale: dictionary.meta.openGraphLocale,
      url: "https://campus.syu.kr",
      siteName: "SYU CAMPUS",
      title: dictionary.meta.title,
      description: dictionary.meta.description,
      images: [
        {
          url: "/images/syu-kr-logo.png",
          width: 512,
          height: 512,
          alt: "SYU CAMPUS",
        },
      ],
    },
    twitter: {
      card: "summary",
      title: dictionary.meta.title,
      description: dictionary.meta.description,
      images: ["/images/syu-kr-logo.png"],
    },
    verification: {
      google: "5Ow1OdBZo0zgRn7w0rscMVMBYlw71tIxaw79JoYgCfY",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "SYU CAMPUS",
    },
    icons: {
      icon: "/images/favicon.ico",
      apple: "/images/syu-kr-logo.png",
    },
    manifest: "/manifest.json",
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3182F6",
  colorScheme: "light",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getRequestLocale();
  const headerStore = await headers();
  const nonce = headerStore.get(CSP_NONCE_HEADER_NAME) || undefined;

  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <head>
        <meta
          name="google-site-verification"
          content="Gy1EGZh0gfxtv6UGI1szYk9uo1YzjaDMyoHRca7EZj4"
        />
        <meta name="theme-color" content="#3182F6" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />

        <Script
          nonce={nonce}
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`}
          strategy="afterInteractive"
        />
        <Script
          id="google-analytics"
          nonce={nonce}
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: GOOGLE_ANALYTICS_SCRIPT,
          }}
        />
        <StructuredDataScript
          id="website-schema"
          nonce={nonce}
          data={createWebSiteSchema(locale)}
        />
      </head>
      <body>
        <LocaleProvider locale={locale}>
          <Providers>
            <Header />
            <main className="min-h-screen pb-20 md:pb-0">{children}</main>
            <Footer locale={locale} />
            <BottomNav />
          </Providers>
        </LocaleProvider>
      </body>
    </html>
  );
}
