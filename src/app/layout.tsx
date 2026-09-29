import type { Metadata } from 'next';
import './globals.css';
import DbInitializer from '@/components/DbInitializer';
import PWARegister from '@/components/PWARegister';

const APP_NAME = '모임터';

export const metadata: Metadata = {
  title: '모임터 · 교회 연합 행사 등록',
  description: '여름성경학교, 겨울 수련회, 세미나 등 교회 연합 행사의 참가 신청, 참가비 정산, 엑셀 명단, 자동 조편성까지 한 번에 처리하는 플랫폼',
  applicationName: APP_NAME,
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_NAME
  },
  openGraph: {
    siteName: APP_NAME,
    title: '모임터 · 교회 연합 행사 등록',
    description: '교회 연합 행사의 참가 신청과 관리를 한 곳에서',
    type: 'website',
    locale: 'ko_KR'
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
