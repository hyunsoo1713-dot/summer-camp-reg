import type { NextConfig } from "next";

// 예전 단일 지방회용 주소(옛날 문)는 모두 첫 화면으로 보냅니다.
const LEGACY_PATHS = ['/admin', '/manager', '/register', '/edit', '/login', '/signup-request'];

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'", // Next.js가 페이지에 넣는 작은 스크립트 때문에 필요
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // 카카오톡·네이버·밴드 등 링크 미리보기 로봇이 행사 제목을 제대로 읽도록, 이 로봇들에게는 제목을 <head>에 바로 넣어 보냅니다.
  htmlLimitedBots:
    /kakaotalk-scrap|kakaostory|Daum|Yeti|naver|BAND|facebookexternalhit|Twitterbot|Slackbot|Discordbot|WhatsApp|LinkedInBot|TelegramBot|[\w-]+-Google|Google-[\w-]+|Bingbot|applebot/i,
  async redirects() {
    return LEGACY_PATHS.map(source => ({ source, destination: '/', permanent: false }));
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // 항상 https로만 접속 (1년)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // 카메라·마이크·위치 등 기기 기능은 쓰지 않음
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          // 이 앱이 불러올 수 있는 것만 허용 (다른 사이트의 스크립트 실행 차단)
          { key: 'Content-Security-Policy', value: CSP },
        ],
      },
    ];
  },
};

export default nextConfig;
