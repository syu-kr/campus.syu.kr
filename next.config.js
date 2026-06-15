/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

const isProduction = process.env.NODE_ENV === "production";
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  !isProduction ? "'unsafe-eval'" : "",
  "https://www.googletagmanager.com",
  "https://www.gstatic.com",
  "https://apis.google.com",
  "https://dapi.kakao.com",
  "https://t1.daumcdn.net",
  // Kakao Maps bootstraps this child script over HTTP in local/dev.
  !isProduction ? "http://t1.daumcdn.net" : "",
].filter(Boolean);
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src ${scriptSrc.join(" ")}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  [
    "img-src",
    "'self'",
    "data:",
    "blob:",
    "https://www.googletagmanager.com",
    "https://*.googleusercontent.com",
    "https://*.gstatic.com",
    "https://*.daumcdn.net",
    "https://*.kakaocdn.net",
    "https://t1.daumcdn.net",
    // Kakao map tiles can be served over HTTP by the dev SDK bootstrap.
    !isProduction ? "http://*.daumcdn.net" : "",
  ].filter(Boolean).join(" "),
  [
    "connect-src",
    "'self'",
    !isProduction ? "webpack:" : "",
    "https://www.google-analytics.com",
    "https://*.google-analytics.com",
    "https://region1.google-analytics.com",
    "https://analytics.google.com",
    "https://*.googleapis.com",
    "https://firebaseinstallations.googleapis.com",
    "https://fcmregistrations.googleapis.com",
    "https://*.firebaseio.com",
    "https://*.kakao.com",
    "https://*.kakaocdn.net",
    "https://*.daumcdn.net",
  ].filter(Boolean).join(" "),
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  isProduction ? "upgrade-insecure-requests" : "",
].filter(Boolean).join("; ");

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
    dangerouslyAllowSVG: true,
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

  // 캐싱 설정
  headers: async () => {
    const securityHeaders = [
      {
        key: "Content-Security-Policy",
        value: contentSecurityPolicy,
      },
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

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/api/:path*",
        headers: [
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
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store",
          },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
      {
        source: "/more/meet/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store",
          },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
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
