import type { Metadata, Viewport } from "next";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { BottomNav } from "./components/BottomNav";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | 삼육대 캠퍼스",
    default: "삼육대 캠퍼스 - 학생 통합 정보 플랫폼",
  },
  description: "삼육대학교 공지사항, 학식, 학사일정을 한눈에 확인하세요.",
  keywords: "삼육대, 캠퍼스, 공지사항, 학식, 학사일정",
  author: "Sangmyung University",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "삼육대 캠퍼스",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
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
        <link rel="manifest" href="/manifest.json" />
        <script
          async
          src="https://cdn.jsdelivr.net/npm/pwacompat@2.0.11/pwacompat.js"
        ></script>
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
