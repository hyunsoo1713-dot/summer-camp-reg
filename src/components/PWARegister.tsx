'use client';

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('PWA Service Worker registered successfully:', reg.scope);
            // 최신 서비스 워커 발견 시 기존 캐시/제어권을 즉시 교체하도록 업데이트 요청
            reg.update();
          })
          .catch((err) => {
            console.error('PWA Service Worker registration failed:', err);
          });
      });
    }
  }, []);

  return null;
}
