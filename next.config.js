/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  // 이미지 최적화
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // 슬래시 제거로 성능 개선
  trailingSlash: false,

  // 압축 설정
  compress: true,

  // 빌드 최적화: 개발 중 불필요한 source map 제거
  productionBrowserSourceMaps: false,

  // 온디맨드 페이지 생성 최적화
  onDemandEntries: {
    maxInactiveAge: 60 * 1000, // 60초
    pagesBufferLength: 5,
  },

  // 빌드 캐시 활성화
  experimental: {
    optimizePackageImports: ["@tanstack/react-query"],
  },

  rewrites: async () => [
    {
      source: "/bus/shuttle",
      destination: "/api/bus/shuttle",
    },
  ],
  redirects: async () => [
    {
      source: "/index",
      destination: "/",
      permanent: true,
    },
    {
      source: "/en/index",
      destination: "/en",
      permanent: true,
    },
    {
      source: "/more/scholarship",
      destination: "/academic/scholarship",
      permanent: true,
    },
    {
      source: "/more/phone",
      destination: "/campus/phone",
      permanent: true,
    },
    {
      source: "/more/campus-tips",
      destination: "/campus/campus-tips",
      permanent: true,
    },
    {
      source: "/more/campus-tips/suggest",
      destination: "/campus/campus-tips/suggest",
      permanent: true,
    },
  ],

  // 캐싱 설정
  headers: async () => {
    const securityHeaders = [
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      {
        key: "X-Permitted-Cross-Domain-Policies",
        value: "none",
      },
    ];
    const noStoreHeaders = [
      {
        key: "Cache-Control",
        value: "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
      {
        key: "Pragma",
        value: "no-cache",
      },
      {
        key: "Expires",
        value: "0",
      },
    ];
    const sensitiveApiSources = [
      "/api/admin/:path*",
      "/api/notifications/:path*",
      "/api/contact",
      "/api/campus-tips/suggestions",
      "/api/meet/:path*",
      "/api/lecture/timetable/shares/:path*",
    ];
    const noIndexPrivatePageHeaders = [
      {
        key: "Cache-Control",
        value: "private, no-store",
      },
      {
        key: "X-Robots-Tag",
        value: "noindex, nofollow",
      },
    ];

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
          },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
      ...sensitiveApiSources.map((source) => ({
        source,
        headers: noStoreHeaders,
      })),
      {
        source: "/admin/:path*",
        headers: noIndexPrivatePageHeaders,
      },
      ...["/more/meet/:roomId", "/en/more/meet/:roomId"].map((source) => ({
        source,
        headers: noIndexPrivatePageHeaders,
      })),
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json",
          },
        ],
      },
      {
        source: "/data/:path*.json",
        headers: noStoreHeaders,
      },
      // 정적 이미지, 폰트 등 - 5일(432000초) 캐싱
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=432000, immutable",
          },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=432000, immutable",
          },
        ],
      },
      // 다른 정적 자산 - 5일 캐싱
      {
        source: "/:path*\\.(png|jpg|jpeg|gif|webp|svg|ico)$",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=432000, immutable",
          },
        ],
      },
    ];
  },
};

module.exports = withBundleAnalyzer(nextConfig);
