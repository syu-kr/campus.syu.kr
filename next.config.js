/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
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
