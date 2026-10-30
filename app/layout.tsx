import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { ManagedBanners } from "./components/ManagedBanners";
import { getPublicBanners } from "@/lib/server/public-managed-content";
import { measureHomeTask, traceHomeData } from "@/lib/server/home-performance";
import { getKoreaNow } from "@/lib/home";
import { PageTranslationStatus } from "./components/ContentTranslation";
import Script from "next/script";
import { SEARCH_RETURN_BOOTSTRAP } from "@/lib/search-return-bootstrap";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { BottomNav } from "./components/BottomNav";
import { SiteContent } from "./components/SiteContent";
import { NotificationPermissionPrompt } from "./components/NotificationPermissionPrompt";
import { LocaleProvider } from "./components/LocaleProvider";
import { StructuredDataScript } from "./components/StructuredDataScript";
import { Providers } from "./providers";
import {
  LOCALE_HEADER_NAME,
  PATHNAME_HEADER_NAME,
  createLocalizedAlternates,
  getDictionary,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n";
import { createSiteIdentitySchema } from "@/lib/structured-data";
import { createPageMetadata } from "@/lib/page-metadata";
import { areRoommatesEnabled } from "@/lib/roommates";
import "./fonts/pretendard-v1.3.9/pretendardvariable-dynamic-subset.css";
import "./globals.css";

const GOOGLE_ANALYTICS_ID = "G-SD8QFQWFVQ";
const GOOGLE_ANALYTICS_SCRIPT = `
(function initializeGoogleAnalytics() {
  if (window.location.hostname !== 'campus.syu.kr') return;
  if (/^\\/(?:en\\/)?(?:campus\\/roommates(?:\\/|$)|more\\/meet\\/[^/]+(?:\\/|$))/.test(window.location.pathname)) {
    window['ga-disable-${GOOGLE_ANALYTICS_ID}'] = true;
  }
  if (window['ga-disable-${GOOGLE_ANALYTICS_ID}']) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){window.dataLayer.push(arguments);};
  var pageReferrer = document.referrer.split('?')[0].split('#')[0];
  if (pageReferrer) {
    try {
      var referrerUrl = new URL(pageReferrer);
      if (/^\\/(?:en\\/)?more\\/meet\\/[^/]+(?:\\/|$)/.test(referrerUrl.pathname)) {
        pageReferrer = referrerUrl.origin;
      }
    } catch {
      pageReferrer = '';
    }
  }
  window.gtag('js', new Date());
  window.gtag('config', '${GOOGLE_ANALYTICS_ID}', {
    page_location: window.location.origin + window.location.pathname,
    page_referrer: pageReferrer
  });

  (function scheduleGoogleAnalytics() {
    function loadGoogleAnalytics() {
      if (window['ga-disable-${GOOGLE_ANALYTICS_ID}']) return;
      var script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}';
      document.head.appendChild(script);
    }

    function scheduleLoad() {
      window.setTimeout(loadGoogleAnalytics, 4000);
    }

    if (document.readyState === 'complete') {
      scheduleLoad();
    } else {
      window.addEventListener('load', scheduleLoad, { once: true });
    }
  })();
})();
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

  return {
    ...createPageMetadata({
      title: dictionary.meta.title,
      description: dictionary.meta.description,
      pathname,
      locale,
    }),
    metadataBase: new URL("https://campus.syu.kr"),
    applicationName: "SYU CAMPUS",
    title: {
      template: "%s",
      default: dictionary.meta.title,
    },
    description: dictionary.meta.description,
    keywords: dictionary.meta.keywords,
    authors: [{ name: "SYU KR" }],
    alternates: createLocalizedAlternates(pathname, locale),
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
    verification: {
      google: "5Ow1OdBZo0zgRn7w0rscMVMBYlw71tIxaw79JoYgCfY",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "SYU CAMPUS",
    },
    icons: {
      icon: "/images/syu-campus-favicon-48-m3-smile.png",
      apple: "/images/syu-campus-apple-touch-icon-180-m3-smile.png",
    },
    manifest: "/manifest.json",
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2459d4",
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
  const pathname = await getRequestPathname();
  const isPrivateAnalyticsPage = /^\/(?:en\/)?(?:campus\/roommates(?:\/|$)|more\/meet\/[^/]+(?:\/|$))/.test(pathname);
  const showSiteTopBanners = !isPrivateAnalyticsPage && !/^\/(?:en\/)?admin(?:\/|$)/.test(pathname);
  const bannerNow = getKoreaNow().getTime();
  // Resolve the bounded public snapshot before the first shell to avoid pushing visible content down.
  const [siteTopBanners, popupBanners] = showSiteTopBanners
    ? await traceHomeData("layout-banners", () => Promise.all([
      measureHomeTask("site-top", () => getPublicBanners("site-top", bannerNow)),
      measureHomeTask("popup", () => getPublicBanners("popup", bannerNow)),
    ])) : [[], []];
  const naverVerification = process.env.NAVER_SITE_VERIFICATION?.trim();
  const bingVerification = process.env.BING_SITE_VERIFICATION?.trim();

  return (
    <html lang={locale} className="m3-root" data-scroll-behavior="smooth">
      <head>
        <script id="search-return-bootstrap" nonce={nonce} dangerouslySetInnerHTML={{ __html: SEARCH_RETURN_BOOTSTRAP }} />
        <meta
          name="google-site-verification"
          content="Gy1EGZh0gfxtv6UGI1szYk9uo1YzjaDMyoHRca7EZj4"
        />
        {/* Ownership verifiers must see these tags in the initial HTML head. */}
        {naverVerification && (
          <meta name="naver-site-verification" content={naverVerification} />
        )}
        {bingVerification && (
          <meta name="msvalidate.01" content={bingVerification} />
        )}
        <meta name="theme-color" content="#2459d4" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />

        {process.env.NODE_ENV === "production" && !isPrivateAnalyticsPage && <Script
          id="google-analytics"
          nonce={nonce}
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: GOOGLE_ANALYTICS_SCRIPT,
          }}
        />}
        <StructuredDataScript
          id="site-identity-schema"
          nonce={nonce}
          data={createSiteIdentitySchema(locale)}
        />
      </head>
      <body className="m3-site">
        <LocaleProvider locale={locale}>
          <Providers roommatesEnabled={areRoommatesEnabled()}>
            <Header />
            {showSiteTopBanners && <ManagedBanners placement="site-top" initialBanners={siteTopBanners} initialNow={bannerNow} />}
            <ManagedBanners placement="popup" initialBanners={popupBanners} initialNow={bannerNow} nonce={nonce} />
            <SiteContent initialPathname={pathname}>
              <PageTranslationStatus />
              {children}
            </SiteContent>
            <Footer locale={locale} />
            <NotificationPermissionPrompt />
            <BottomNav />
            <span hidden data-managed-popup-shell-ready />
          </Providers>
        </LocaleProvider>
      </body>
    </html>
  );
}
