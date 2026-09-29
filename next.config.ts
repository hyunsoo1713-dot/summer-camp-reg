import type { NextConfig } from "next";

// 예전 단일 지방회용 주소(옛날 문)는 모두 첫 화면으로 보냅니다.
const LEGACY_PATHS = ['/admin', '/manager', '/register', '/edit', '/login', '/signup-request'];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async redirects() {
    return LEGACY_PATHS.map(source => ({ source, destination: '/', permanent: false }));
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
