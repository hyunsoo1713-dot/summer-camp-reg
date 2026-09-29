import type { NextConfig } from "next";

// 예전 단일 지방회용 주소(옛날 문)는 모두 첫 화면으로 보냅니다.
const LEGACY_PATHS = ['/admin', '/manager', '/register', '/edit', '/login', '/signup-request'];

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
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
