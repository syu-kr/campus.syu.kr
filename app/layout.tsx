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
    template: "%s | SYU CAMPUS",
    default: "삼육대 캠퍼스 - 학생 통합 정보 플랫폼",
  },
  description: "삼육대학교 공지사항, 학식, 학사일정을 한눈에 확인하세요.",
  keywords: "삼육대, 캠퍼스, 공지사항, 학식, 학사일정",
  authors: [{ name: "SYU KR" }],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "삼육대 캠퍼스",
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

        {/* Preconnect to Kakao resources for faster loading */}
        <link rel="preconnect" href="https://dapi.kakao.com" />
        <link rel="preconnect" href="https://t1.daumcdn.net" />

        {/* Kakao Maps SDK - 동기 로딩 필수 (레거시 라이브러리) */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&libraries=services,drawing`}
          suppressHydrationWarning
        />
        {/* Promise 초기화 - defer로 SDK 이후 실행 */}
        <script
          suppressHydrationWarning
          defer
          dangerouslySetInnerHTML={{
            __html: `
              window.kakaoMapsReady = new Promise((resolve) => {
                let attempts = 0;
                const check = () => {
                  attempts++;
                  if (window.kakao?.maps?.LatLng) {
                    console.log('✓ [layout] SDK ready after', attempts, 'attempts');
                    resolve(true);
                  } else if (attempts < 20) {
                    setTimeout(check, 50);
                  } else {
                    console.log('✗ [layout] SDK failed after', attempts, 'attempts');
                    resolve(false);
                  }
                };
                check();
              });
            `,
          }}
        />
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
