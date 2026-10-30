/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});
const { withSentryConfig } = require("@sentry/nextjs/config");
const uploadSentryArtifacts = Boolean(process.env.SENTRY_AUTH_TOKEN);

const PERMANENT_REDIRECTS = [
  ["/index", "/"],
  ["/en/index", "/en"],
  ["/more/scholarship", "/academic/scholarship"],
  ["/en/more/scholarship", "/en/academic/scholarship"],
  ["/more/phone", "/campus/phone"],
  ["/en/more/phone", "/en/campus/phone"],
  ["/more/campus-tips", "/campus/campus-tips"],
  ["/en/more/campus-tips", "/en/campus/campus-tips"],
  ["/more/campus-tips/suggest", "/campus/campus-tips/suggest"],
  ["/en/more/campus-tips/suggest", "/en/campus/campus-tips/suggest"],
  ["/service/notices/018-roommate-policy-update", "/service/notices/017-roommate-board"],
  ["/en/service/notices/018-roommate-policy-update", "/en/service/notices/017-roommate-board"],
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Keep verified fallback snapshots in serverless functions after switching the primary store.
  outputFileTracingIncludes: {
    "/*": ["./public/data/*.json", "./public/cafeteria/student-restaurant-1.json", "./data-source/fallbacks/student-restaurant-1.json", "./public/service-notices/**/*.md"],
  },
  // Keep local files and contributor documentation out of server function packages.
  outputFileTracingExcludes: {
    "/*": ["./output/**/*", "./.cache/**/*", "./.playwright-mcp/**/*", "./.env*", "./.vercel/**/*", "./*.md", "./docs/**/*.md", "./app/fonts/**/*.md", "./data-source/**/*.md", "./vendor/**/*.md", "./public/brand/**/*.md"],
  },
  turbopack: {
    root: __dirname,
  },
  // Turbopack does not use Sentry's webpack tree-shaking settings.
  compiler: {
    define: {
      __SENTRY_DEBUG__: false,
      __SENTRY_TRACING__: false,
    },
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

  // Generate private browser maps only for builds that can upload them.
  productionBrowserSourceMaps: uploadSentryArtifacts,

  // 온디맨드 페이지 생성 최적화
  onDemandEntries: {
    maxInactiveAge: 60 * 1000, // 60초
    pagesBufferLength: 5,
  },

  // 빌드 캐시 활성화
  experimental: {
    optimizePackageImports: ["@tanstack/react-query"],
  },

  rewrites: async () => ({
    beforeFiles: process.env.PUBLIC_DATA_BACKEND === "firebase" ? [
      { source: "/data/:fileName", destination: "/api/public-data/:fileName" },
      { source: "/cafeteria/student-restaurant-1.json", destination: "/api/public-data/student-restaurant-1.json" },
    ] : [],
    afterFiles: [{ source: "/bus/shuttle", destination: "/api/bus/shuttle" }],
    fallback: [],
  }),
  redirects: async () =>
    PERMANENT_REDIRECTS.map(([source, destination]) => ({
      source,
      destination,
      permanent: true,
    })),

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
      "/api/roommates/:path*",
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
      ...["/admin/:path*", "/en/admin/:path*"].map((source) => ({
        source,
        headers: noIndexPrivatePageHeaders,
      })),
      ...["/more/meet/:roomId", "/en/more/meet/:roomId"].map((source) => ({
        source,
        headers: noIndexPrivatePageHeaders,
      })),
      ...["/campus/roommates/:path*", "/en/campus/roommates/:path*", "/api/roommates/:path*", "/api/admin/roommate-posts", "/api/admin/roommate-reports"].map((source) => ({
        source,
        headers: [...noIndexPrivatePageHeaders, { key: "Referrer-Policy", value: "no-referrer" }],
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
        source: "/.well-known/assetlinks.json",
        headers: [
          {
            key: "Content-Type",
            value: "application/json; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=300, must-revalidate",
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

module.exports = withSentryConfig(withBundleAnalyzer(nextConfig), {
  org: process.env.SENTRY_ORG || "singhic-eu",
  project: process.env.SENTRY_PROJECT || "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  useRunAfterProductionCompileHook: uploadSentryArtifacts,
  sourcemaps: {
    disable: !uploadSentryArtifacts,
    deleteSourcemapsAfterUpload: true,
  },
  release: { create: uploadSentryArtifacts, finalize: uploadSentryArtifacts },
  telemetry: false,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
      removeTracing: true,
    },
  },
});
