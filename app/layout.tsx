import type { Metadata, Viewport } from "next";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { BottomNav } from "./components/BottomNav";
import { Providers } from "./providers";
import "./globals.css";

// Pretendard 폰트 import
import "@fontsource/pretendard";

export const metadata: Metadata = {
  title: {
    template: "%s | 삼육대 캠퍼스",
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
        <meta name="theme-color" content="#3182F6" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        <script
          src="https://cdn.jsdelivr.net/npm/pwacompat@2.0.11/pwacompat.js"
          async
        />
        {/* Kakao Maps SDK - 스트릭트 로딩 순서 */}
        <script
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&libraries=services,drawing`}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // 즉시 SDK 준비 확인
              console.log('[layout] SDK check:', { 
                kakao: typeof window.kakao,
                maps: typeof window.kakao?.maps,
                LatLng: typeof window.kakao?.maps?.LatLng
              });
              
              window.kakaoMapsReady = new Promise((resolve) => {
                let attempts = 0;
                const check = () => {
                  attempts++;
                  if (window.kakao?.maps?.LatLng) {
                    console.log('✓ [layout] SDK ready after', attempts, 'checks');
                    resolve(true);
                  } else if (attempts < 50) {
                    setTimeout(check, 100);
                  } else {
                    console.log('✗ [layout] SDK failed after', attempts, 'checks');
                    resolve(false);
                  }
                };
                check();
              });
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
