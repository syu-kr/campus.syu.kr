import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { BottomNav } from "./components/BottomNav";
import { Providers } from "./providers";
import "./globals.css";

// Pretendard 폰트 import - 필요한 weight만 로드
import "@fontsource/pretendard/400.css"; // Regular
import "@fontsource/pretendard/500.css"; // Medium
import "@fontsource/pretendard/600.css"; // Semibold
import "@fontsource/pretendard/700.css"; // Bold

export const metadata: Metadata = {
  title: {
    template: "%s",
    default: "SYU CAMPUS - 학생 통합 정보 플랫폼",
  },
  description: "삼육대학교 공지사항, 학식, 학사일정을 한눈에 확인하세요.",
  keywords: "삼육대, 삼육대학교, 캠퍼스, 공지사항, 학식, 학사일정",
  authors: [{ name: "SYU KR" }],
  verification: {
    google: "5Ow1OdBZo0zgRn7w0rscMVMBYlw71tIxaw79JoYgCfY",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SYU CAMPUS",
  },
  icons: {
    icon: "/images/syu-kr-logo.png",
    apple: "/images/syu-kr-logo.png",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#3182F6",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
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
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />

        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-SD8QFQWFVQ"
          strategy="afterInteractive"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-SD8QFQWFVQ');
            `,
          }}
        />
        {/* JSON-LD Organization Schema */}
        <Script
          id="organization-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "SYU CAMPUS",
              url: "https://campus.syu.kr",
              logo: "https://campus.syu.kr/images/syu-kr-logo.png",
              description:
                "삼육대학교 학생들을 위한 공지사항, 학식, 셔틀버스, 학사일정 통합 정보 플랫폼",
              sameAs: ["https://www.syu.kr"],
              address: {
                "@type": "PostalAddress",
                streetAddress: "서울특별시 노원구 공릉동",
                addressLocality: "서울",
                postalCode: "01795",
                addressCountry: "KR",
              },
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "Customer Service",
              },
            }),
          }}
        />
      </head>
      <body>
        <Providers>
          <Header />
          <main className="min-h-screen pb-20 md:pb-0">{children}</main>
          <Footer />
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
