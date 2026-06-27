import type { Metadata } from 'next';
import './globals.css';
import DbInitializer from '@/components/DbInitializer';
import PWARegister from '@/components/PWARegister';

export const metadata: Metadata = {
  title: '여름행사 등록 - 교회 연합 행사 등록 및 관리 시스템',
  description: '교회 연합 여름행사 등록, 참가비 정산, 엑셀 다운로드, 자동 조편성까지 한 번에 처리하는 스마트 반응형 플랫폼',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '여름행사등록'
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <PWARegister />
        <DbInitializer>
          {children}
        </DbInitializer>
      </body>
    </html>
  );
}
