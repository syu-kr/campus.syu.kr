/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

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

  // 폰트 최적화
  optimizeFonts: true,

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

  // Localhost 개발 서버에서 external API 프록싱
  rewrites: async () => {
    return {
      beforeFiles: [
        {
          source: "/bus/busStatusList.php",
          destination: "http://nexmotion.co.kr/bus/busStatusList.php",
        },
      ],
    };
  },

  // 캐싱 설정
  headers: async () => {
    return [
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json",
          },
        ],
      },
      // 공지사항 JSON - 항상 최신 데이터 필요! 캐싱 금지
      {
        source: "/data/announcements-:category*.json",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
        ],
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
      // Next.js 생성 JS/CSS 번들 - 5일 캐싱 (immutable은 Next.js가 자동 추가)
      {
        source: "/_next/static/:path*",
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

module.exports = nextConfig;
